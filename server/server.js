/**
 * @file server.js
 * @description Trip Planner Express server with Redis caching, Google-based dining/sights/history APIs, and local trip JSON persistence.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

import { fetchRestaurants } from './helpers/diningHelpers.js';
import { googleApiKey } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const redisClient = createClient();
redisClient.on('error', err => console.error('Redis error:', err));

/**
 * @typedef {Object} Restaurant
 * @property {string} name
 * @property {string} address
 * @property {string} [place_id]
 * @property {string} source
 *
 * @typedef {Object} SourceMetadata
 * @property {string} source
 * @property {string} status
 * @property {number} [count]
 * @property {string} [error]
 *
 * @typedef {Object} DiningResponse
 * @property {Restaurant[]} data
 * @property {SourceMetadata[]} sources
 *
 * @typedef {Object} Lodging
 * @property {string} name
 * @property {string} address
 * @property {string} phone
 * @property {string} roomType
 *
 * @typedef {Object} Activity
 * @property {string} name
 * @property {string} location
 * @property {string} notes
 * @property {string} length
 *
 * @typedef {Object} Day
 * @property {string} location
 * @property {string} wakeUpTime
 * @property {Lodging} lodging
 * @property {Activity[]} activities
 * @property {any} [suggestions]
 *
 * @typedef {Object} TripPayload
 * @property {string} tripName
 * @property {string} startDate
 * @property {Day[]} trip
 */

// Wait for Redis
async function waitForRedis(retries = 10, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            await redisClient.ping();
            console.log('✅ Redis is ready');
            return;
        } catch {
            console.warn(`⏳ Waiting for Redis... (${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    console.error('❌ Redis unavailable after retries. Exiting.');
    process.exit(1);
}

await redisClient.connect();
await waitForRedis();

app.use(cors());
app.use(express.static('public', { maxAge: 0 }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const tripsDir = path.join(__dirname, 'trips');
if (!fs.existsSync(tripsDir)) fs.mkdirSync(tripsDir);

/**
 * GET /config
 * Returns API key for client use.
 */
app.get('/config', (_, res) => {
    res.json({ googleMapsApiKey: googleApiKey });
});

/**
 * GET /getDiningSuggestions?location=
 * Caches and fetches top restaurants using multiple sources.
 * @returns {DiningResponse}
 */
app.get('/getDiningSuggestions', async (req, res) => {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'Location is required.' });

    const cacheKey = `dining:${location.toLowerCase()}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    try {
        const { results, sources } = await fetchRestaurants(location, googleApiKey);
        const response = { data: results, sources };
        await redisClient.set(cacheKey, JSON.stringify(response), { EX: 3600 });
        res.json(response);
    } catch (err) {
        console.error('❌ Error in getDiningSuggestions:', err.message);
        res.status(500).json({ error: 'Dining suggestions fetch failed', details: err.message });
    }
});

/**
 * GET /getSiteSuggestions?location=
 * Returns tourist attractions via Google Places.
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
 * GET /getLocationHistory?location=
 * Returns short summary from Wikipedia.
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
 * POST /saveTrip
 * Saves trip JSON to disk. Removes suggestions before saving.
 * @param {TripPayload} req.body
 */
app.post('/saveTrip', (req, res) => {
    const { tripName, startDate, trip } = req.body;
    if (!tripName || !startDate || !trip || !Array.isArray(trip)) {
        return res.status(400).json({ message: 'Missing required fields or invalid trip data' });
    }

    const cleanedTrip = trip.map(({ suggestions, ...rest }) => rest);
    const cleanedPayload = { tripName, startDate, trip: cleanedTrip };

    const filename = `${tripName}_${startDate}.json`;
    const filePath = path.join(tripsDir, filename);

    fs.writeFile(filePath, JSON.stringify(cleanedPayload, null, 2), err => {
        if (err) {
            console.error('Save error:', err);
            return res.status(500).json({ message: 'Failed to save trip' });
        }
        res.json({ message: 'Trip saved successfully' });
    });
});

/**
 * GET /getTrips
 * Lists saved trip files.
 */
app.get('/getTrips', (_, res) => {
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
 * GET /getTrip?tripName=
 * Loads a specific trip file.
 */
app.get('/getTrip', (req, res) => {
    const { tripName } = req.query;
    const filePath = path.join(tripsDir, `${tripName}.json`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Trip read error:', err);
            return res.status(500).send('Failed to load trip');
        }
        res.json(JSON.parse(data));
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Trip Planner server running at http://localhost:${PORT}`);
    console.log(`📁 Trip files stored in: ${tripsDir}`);
});
