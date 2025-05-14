import axios from 'axios';

/**
 * Generic helper for querying Google Places Text Search with filtering.
 * Applies ranking and type constraints and slices top 5 results.
 *
 * @param {string} query - Search query string (e.g., 'restaurants near Paris')
 * @param {string} apiKey - Google Maps API key
 * @param {string} source - Tag for the source of the query (e.g., 'Michelin')
 * @param {Object} [options={}] - Additional search options (e.g., type, rankby)
 * @returns {Promise<Array<{ name: string, address: string, place_id: string, source: string }>>}
 */
async function fetchGoogleTextSearch(query, apiKey, source, options = {}) {
    const params = {
        query,
        key: apiKey,
        type: options.type || undefined,
        rankby: options.rankby || 'prominence'
    };

    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const res = await axios.get(url, { params });

    if (res.data.status !== 'OK') {
        console.warn(`[fetchGoogleTextSearch] Google API returned status: ${res.data.status}`);
        return [];
    }

    return (res.data.results || []).slice(0, 5).map(p => ({
        name: p.name,
        address: p.formatted_address,
        place_id: p.place_id,
        source
    }));
}

/**
 * Fetches top 5 general restaurants near a location using Google Places.
 * Uses type=restaurant for improved accuracy.
 *
 * @param {string} location - Location name or address.
 * @param {string} apiKey - Google Maps API key.
 * @returns {Promise<Array>}
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
 * Fetches top 5 Michelin-style restaurants using Google Places with keyword.
 *
 * @param {string} location - Location name or address.
 * @param {string} apiKey - Google Maps API key.
 * @returns {Promise<Array>}
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
 * Fetches top 5 James Beard award-style restaurants using keyword match.
 *
 * @param {string} location - Location name or address.
 * @param {string} apiKey - Google Maps API key.
 * @returns {Promise<Array>}
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
 * Fetches top 5 Eater 38 restaurants using Google Places Text Search.
 *
 * @param {string} location - Location name or address.
 * @param {string} apiKey - Google Maps API key.
 * @returns {Promise<Array>}
 */
export async function fetchEaterRestaurants(location, apiKey) {
    return fetchGoogleTextSearch(
        `eater 38 restaurants near ${location}`,
        apiKey,
        'Eater',
        { type: 'restaurant' }
    );
}
