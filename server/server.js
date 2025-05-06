// server/server.js

import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// __dirname replacement in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Load your config (you can change this path if it's elsewhere)
import { googleApiKey } from '../config/config.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.static('public', { maxAge: 0 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trips directory setup
const tripsDir = path.join(__dirname, 'trips');
if (!fs.existsSync(tripsDir)) fs.mkdirSync(tripsDir);

// Config route
app.get('/config', (req, res) => {
  res.json({ googleMapsApiKey: googleApiKey });
});

// 🌐 Dining suggestions
app.get('/getDiningSuggestions', async (req, res) => {
  const { location } = req.query;
  if (!location) return res.status(400).send('Location parameter is required');

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurants+near+${encodeURIComponent(location)}&key=${googleApiKey}`;
    const result = await axios.get(url);
    if (!result.data || result.data.status !== 'OK') {
      console.error('Places API error:', result.data);
      return res.status(500).send(`Failed: ${result.data.status}`);
    }
    res.json(result.data);
  } catch (err) {
    console.error('Dining fetch error:', err);
    res.status(500).send('Failed to retrieve dining suggestions');
  }
});

// 🗺 Tourist sights
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

// 🏛 History via Wikipedia
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

// 💾 Save trip
app.post('/saveTrip', (req, res) => {
  const { tripName, startDate, trip } = req.body;
  if (!tripName || !startDate || !trip) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const filename = `${tripName}_${startDate}.json`;
  const filePath = path.join(tripsDir, filename);

  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) {
      console.error('Save error:', err);
      return res.status(500).json({ message: 'Failed to save trip' });
    }
    res.json({ message: 'Trip saved successfully' });
  });
});

// 📁 Get trip list
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

// 📄 Load a specific trip
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
