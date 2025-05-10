import axios from 'axios';

/**
 * Generic helper for querying Google Places Text Search.
 * @param {string} query - Search query string
 * @param {string} apiKey - Google API key
 * @param {string} source - Name of the original source (for tagging)
 * @returns {Promise<Array>}
 */
async function fetchGoogleTextSearch(query, apiKey, source) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await axios.get(url);
    return res.data.results.map(p => ({
        name: p.name,
        address: p.formatted_address,
        place_id: p.place_id,
        source
    }));
}

/**
 * General nearby restaurant search.
 * @param {string} location
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function fetchGooglePlacesRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(`restaurants near ${location}`, apiKey, 'GooglePlaces');
}

/**
 * Simulated Michelin by querying Google with Michelin-specific keyword.
 * @param {string} location
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function fetchMichelinRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(`michelin star restaurants near ${location}`, apiKey, 'Michelin');
}

/**
 * Simulated James Beard search using Google.
 * @param {string} location
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function fetchJamesBeardRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(`james beard award restaurants near ${location}`, apiKey, 'JamesBeard');
}

/**
 * Simulated Eater 38 list search via Google.
 * @param {string} location
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function fetchEaterRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(`eater 38 restaurants near ${location}`, apiKey, 'Eater');
}
