/**
 * Main Express server for Trip Planner
 * Handles config, dining suggestions, trip data CRUD, tourist sights, and Wikipedia history
 * Integrates Redis caching and Google-based restaurant source simulations
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

import { googleApiKey } from '../config/config.js';
import {
	fetchGooglePlacesRestaurants,
	fetchMichelinRestaurants,
	fetchJamesBeardRestaurants,
	fetchEaterRestaurants
} from './helpers/fetchers.js';
import { deduplicateRestaurants } from './helpers/diningHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

/** Redis client for caching API responses */
const redisClient = createClient();
redisClient.on('error', err => console.error('Redis error:', err));

/**
 * Waits until Redis responds to ping, retrying if needed.
 * @param {number} retries - Number of attempts before giving up
 * @param {number} delayMs - Milliseconds to wait between attempts
 */
async function waitForRedis(retries = 10, delayMs = 500) {
	for (let i = 0; i < retries; i++) {
		try {
			await redisClient.ping();
			console.log('✅ Redis is ready');
			return;
		} catch (err) {
			console.warn(`⏳ Waiting for Redis... (${i + 1}/${retries})`);
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}
	}
	console.error('❌ Redis did not respond after retries. Exiting.');
	process.exit(1);
}

// Connect and wait for Redis before proceeding
await redisClient.connect();
await waitForRedis();

// Middleware
app.use(cors());
app.use(express.static('public', { maxAge: 0 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trips directory
const tripsDir = path.join(__dirname, 'trips');
if (!fs.existsSync(tripsDir)) fs.mkdirSync(tripsDir);

/**
 * Returns Google Maps API key for client use
 */
app.get('/config', (req, res) => {
	res.json({ googleMapsApiKey: googleApiKey });
});

/**
 * Wraps a promise with a timeout fallback
 */
const withTimeout = (promise, ms = 5000) =>
	Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
	]);

/**
 * @typedef {Object} Restaurant
 * @property {string} name
 * @property {string} address
 * @property {string} [place_id]
 * @property {string} source
 */

/**
 * @typedef {Object} SourceMetadata
 * @property {string} source
 * @property {string} status
 * @property {number} [count]
 * @property {string} [error]
 */

/**
 * @typedef {Object} DiningResponse
 * @property {Restaurant[]} data
 * @property {SourceMetadata[]} sources
 */

/**
 * Fetches restaurants from multiple sources and returns deduplicated results
 * @route GET /getDiningSuggestions?location=<city>
 * @returns {DiningResponse}
 */
app.get('/getDiningSuggestions', async (req, res) => {
	const { location } = req.query;
	if (!location) return res.status(400).send('Location parameter is required');

	const cacheKey = `dining:${location.toLowerCase()}`;
	const cached = await redisClient.get(cacheKey);
	if (cached) return res.json(JSON.parse(cached));

	const sources = [
		{ name: 'GooglePlaces', fn: loc => fetchGooglePlacesRestaurants(loc, googleApiKey) },
		{ name: 'Michelin', fn: loc => fetchMichelinRestaurants(loc, googleApiKey) },
		{ name: 'JamesBeard', fn: loc => fetchJamesBeardRestaurants(loc, googleApiKey) },
		{ name: 'Eater', fn: loc => fetchEaterRestaurants(loc, googleApiKey) }
	];

	const results = await Promise.allSettled(sources.map(src => withTimeout(src.fn(location))));

	/** @type {Restaurant[]} */
	const allRestaurants = [];
	/** @type {SourceMetadata[]} */
	const metadata = [];

	results.forEach((result, i) => {
		const src = sources[i].name;
		if (result.status === 'fulfilled') {
			allRestaurants.push(...result.value);
			metadata.push({ source: src, status: 'fulfilled', count: result.value.length });
		} else {
			console.warn(`${src} fetch failed:`, result.reason.message);
			metadata.push({ source: src, status: 'rejected', error: result.reason.message });
		}
	});

	const deduped = deduplicateRestaurants(allRestaurants);
	const response = { data: deduped, sources: metadata };
	await redisClient.set(cacheKey, JSON.stringify(response), { EX: 3600 });

	res.json(response);
});

/**
 * Tourist points of interest
 */
app.get('/getSiteSuggestions', async (req, res) => {
	const { location } = req.query;
	if (!location) return res.status(400).json({ error: 'Missing location' });

	try {
		const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=points+of+interest+near+${encodeURIComponent(location)}&key=${googleApiKey}`;
		const response = await axios.get(url);
		res.json(response.data);
	} catch (err) {
		console.error('Site fetch error:', err.message);
		res.status(500).json({ error: 'Failed to fetch site suggestions' });
	}
});

/**
 * Wikipedia summary for the location
 */
app.get('/getLocationHistory', async (req, res) => {
	const { location } = req.query;
	if (!location) return res.status(400).json({ error: 'Missing location' });

	try {
		const searchURL = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(location)}&limit=1&format=json&origin=*`;
		const searchRes = await axios.get(searchURL);
		const bestMatch = searchRes.data[1]?.[0];

		if (!bestMatch) return res.status(404).json({ error: `No article found for ${location}` });

		const summaryURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch)}`;
		const summaryRes = await axios.get(summaryURL);

		res.json(summaryRes.data);
	} catch (err) {
		console.error('History fetch error:', err.message);
		res.status(err.response?.status || 500).json({
			error: 'Failed to retrieve history',
			details: err.response?.data || err.message
		});
	}
});

/**
 * Save trip to JSON file
 */
app.post('/saveTrip', (req, res) => {
	const { tripName, startDate, trip } = req.body;
	if (!tripName || !startDate || !trip) {
		return res.status(400).json({ message: 'Missing required fields' });
	}

	const filename = `${tripName}_${startDate}.json`;
	const filePath = path.join(tripsDir, filename);

	fs.writeFile(filePath, JSON.stringify(req.body, null, 2), err => {
		if (err) {
			console.error('Save error:', err);
			return res.status(500).json({ message: 'Failed to save trip' });
		}
		res.json({ message: 'Trip saved successfully' });
	});
});

/**
 * Return list of saved trip files
 */
app.get('/getTrips', (req, res) => {
	fs.readdir(tripsDir, (err, files) => {
		if (err) {
			console.error('Dir read error:', err);
			return res.status(500).send('Error reading trips');
		}
		const tripFiles = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
		res.json(tripFiles);
	});
});

/**
 * Load a specific trip file
 */
app.get('/getTrip', (req, res) => {
	const tripName = req.query.tripName;
	const filePath = path.join(tripsDir, `${tripName}.json`);

	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			console.error('Trip read error:', err);
			return res.status(500).send('Failed to load trip');
		}
		res.json(JSON.parse(data));
	});
});

// 🚀 Start server
const PORT = 3000;
app.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`);
	console.log(`Trips folder: ${tripsDir}`);
});
