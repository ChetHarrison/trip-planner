import axios from 'axios';

/**
 * @typedef {Object} PlaceResult
 * @property {string} name - Display name of the place
 * @property {string} address - Formatted address from Google
 * @property {string} place_id - Unique Google Maps place identifier
 * @property {string} source - Label for the source that generated this result
 */

/**
 * Queries the Google Places Text Search API and returns simplified top 5 results.
 *
 * @param {string} query - Full query string, e.g., "michelin restaurants near Paris"
 * @param {string} apiKey - Google Maps API key
 * @param {string} source - Label for the source (e.g., "Eater")
 * @param {Object} [options={}] - Optional filters like type or rankby
 * @param {string} [options.type] - Google-supported place type (e.g., 'restaurant')
 * @param {string} [options.rankby='prominence'] - Ranking criteria
 * @returns {Promise<Restaurant[]>} Array of restaurant-like objects
 */
export async function fetchGoogleTextSearch(query, apiKey, source, options = {}) {
    const params = {
        query,
        key: apiKey,
        type: options.type || undefined,
        rankby: options.rankby || 'prominence'
    };

    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    try {
        const res = await axios.get(url, { params });

        if (res.data.status !== 'OK') {
            console.warn(`[fetchGoogleTextSearch] [${source}] status: ${res.data.status}`);
            return [];
        }

        return res.data.results.slice(0, 5).map(place => ({
            name: place.name,
            address: place.formatted_address,
            place_id: place.place_id,
            source
        }));
    } catch (error) {
        console.error(`[fetchGoogleTextSearch] [${source}] failed:`, error.message);
        return [];
    }
}

/**
 * Fetches top 5 general restaurants using Google Text Search.
 *
 * @param {string} location - Location name (e.g., "San Francisco")
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<PlaceResult[]>}
 */
export async function fetchGooglePlacesRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(
        `restaurants near ${location}`,
        apiKey,
        'GooglePlaces',
        { type: 'restaurant' }
    );
}

/**
 * Fetches top 5 Michelin-style restaurants using keyword query.
 *
 * @param {string} location - Location to search near
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<PlaceResult[]>}
 */
export async function fetchMichelinRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(
        `michelin star restaurants near ${location}`,
        apiKey,
        'Michelin',
        { type: 'restaurant' }
    );
}

/**
 * Fetches top 5 James Beard award-style restaurants near location.
 *
 * @param {string} location - City or region name
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<PlaceResult[]>}
 */
export async function fetchJamesBeardRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(
        `james beard award restaurants near ${location}`,
        apiKey,
        'JamesBeard',
        { type: 'restaurant' }
    );
}

/**
 * Fetches top 5 Eater 38 restaurants near a location.
 *
 * @param {string} location - Location to search
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<PlaceResult[]>}
 */
export async function fetchEaterRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(
        `eater 38 restaurants near ${location}`,
        apiKey,
        'Eater',
        { type: 'restaurant' }
    );
}
