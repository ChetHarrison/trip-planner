const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const cors = require('cors');
const { googleApiKey } = require('../config');

app.use(cors());
app.use(express.static('public', { maxAge: 0 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define trips directory at the top of the file
const tripsDir = path.join(__dirname, 'trips');

// Create the 'trips' folder if it doesn't exist
if (!fs.existsSync(tripsDir)) {
    fs.mkdirSync(tripsDir);
}

require('dotenv').config(); // Load .env variables

app.get('/config', (req, res) => {
    res.json({ googleMapsApiKey: googleApiKey }); // ✅ Now serving from config.js
});

console.log("Using API Key from config.js:", googleApiKey);

// Route to get dining suggestions
app.get('/getDiningSuggestions', async (req, res) => {
    const { location } = req.query;

    if (!location) {
        return res.status(400).send('Location parameter is required');
    }

    try {
        // Use the Places API Text Search endpoint directly with the address
        const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurants+near+${encodeURIComponent(location)}&key=${googleApiKey}`;

        console.log(`Fetching restaurants near: ${location}`);

        const placesResponse = await axios.get(placesUrl);

        if (!placesResponse.data || placesResponse.data.status !== 'OK') {
            console.error('Error from Places API:', placesResponse.data);
            return res.status(500).send(`Failed to fetch dining suggestions: ${placesResponse.data.status}`);
        }

        // Send back the restaurant data
        res.json(placesResponse.data);
    } catch (error) {
        console.error('Error fetching dining suggestions:', error);
        res.status(500).send('Failed to retrieve dining suggestions');
    }
});

// Route to get location history
app.get('/getLocationHistory', async (req, res) => {
    const { location } = req.query;
    if (!location) {
        console.error('Missing location parameter');
        return res.status(400).send({ error: 'Missing location parameter' });
    }

    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(location)}`;

    console.log(`Fetching location history for: ${location}`);

    try {
        const response = await axios.get(apiUrl);
        console.log('Location History API Response:', response.data);

        console.log('Rate Limit Headers:');
        console.log('X-RateLimit-Limit:', response.headers['x-ratelimit-limit']);
        console.log('X-RateLimit-Remaining:', response.headers['x-ratelimit-remaining']);
        console.log('Retry-After:', response.headers['retry-after']);

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching location history:', {
            status: error.response?.status,
            message: error.response?.data || error.message,
        });

        if (error.response?.status === 429) {
            console.error('Rate limit exceeded for Wikipedia API.');
        }

        res.status(error.response?.status || 500).send({
            error: 'Failed to retrieve location history',
            details: error.response?.data || error.message,
        });
    }
});

app.post('/saveTrip', (req, res) => {
    const { tripName, startDate, trip } = req.body;

    if (!tripName || !startDate || !trip) {
        return res.status(400).json({ message: "Missing required fields: tripName, startDate, or trip data." });
    }

    const filename = `${tripName}_${startDate}.json`;
    const filePath = path.join(tripsDir, filename);

    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error('Error saving trip: ', err);
            return res.status(500).json({ message: 'Failed to save trip.' });
        }
        res.json({ message: 'In server. Trip saved successfully.' });
    });
});

// Route to get the list of all saved trips
app.get('/getTrips', (req, res) => {
    fs.readdir(tripsDir, (err, files) => {
        if (err) {
            console.error('Error reading trips directory:', err);
            return res.status(500).send('Error reading trips directory');
        }

        console.log('Files found:', files);

        const tripFiles = files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));

        res.json(tripFiles);
    });
});

// Route to get a specific trip by name
app.get('/getTrip', (req, res) => {
    const tripName = req.query.tripName;
    const filePath = path.join(tripsDir, `${tripName}.json`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading trip file:', err);
            return res.status(500).send('Failed to load trip');
        }
        res.json(JSON.parse(data));
    });
});

// Start the server
const PORT = 3000
;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`trips dir ${tripsDir}`);
});
