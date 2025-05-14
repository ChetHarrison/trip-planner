import axios from 'axios';

import {
    fetchGooglePlacesRestaurants,
    fetchMichelinRestaurants,
    fetchJamesBeardRestaurants,
    fetchEaterRestaurants
} from './fetchers.js';

/**
 * @typedef {Object} Restaurant
 * @property {string} name - Display name of the restaurant
 * @property {string} address - Full address
 * @property {string} place_id - Google Maps place ID
 * @property {string} source - Source label (e.g., 'Google', 'Michelin')

 * @typedef {Object} SourceMetadata
 * @property {string} source - Source name
 * @property {'fulfilled'|'rejected'} status - Outcome of the fetch
 * @property {number} [count] - Number of results returned (if successful)
 * @property {string} [error] - Error message if rejected

 * @typedef {Object} DiningResponse
 * @property {Restaurant[]} data - Deduplicated list of restaurants
 * @property {SourceMetadata[]} sources - Status from all sources
 */

/**
 * Perform a single Google Places Text Search query and return top 5 results.
 *
 * @param {string} query - Text search query (e.g., "Michelin restaurants near Paris")
 * @param {string} apiKey - Google API key
 * @param {string} source - Source tag for metadata
 * @returns {Promise<Restaurant[]>}
 */
async function fetchGoogleTextSearch(query, apiKey, source) {
	const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
	const params = {
		query,
		key: apiKey,
		type: 'restaurant',
		rankby: 'prominence'
	};

	const res = await axios.get(url, { params });

	if (res.data.status !== 'OK') {
		console.warn(`[fetchGoogleTextSearch] Google returned status ${res.data.status} for source "${source}"`);
		return [];
	}

	return res.data.results.slice(0, 5).map(place => ({
		name: place.name,
		address: place.formatted_address,
		place_id: place.place_id,
		source
	}));
}

/**
 * Deduplicates restaurant results by `place_id` across sources and limits to top 5.
 *
 * @param {Restaurant[][]} resultSets - Array of arrays of Restaurant objects from multiple sources
 * @returns {Restaurant[]} Array of unique top 5 restaurants
 */
export function deduplicateRestaurants(resultSets) {
    const seen = new Set();
    const merged = [];

    for (const group of resultSets) {
        for (const r of group) {
            if (r.place_id && !seen.has(r.place_id)) {
                seen.add(r.place_id);
                merged.push(r);
            }
            if (merged.length >= 5) break;
        }
        if (merged.length >= 5) break;
    }

    return merged;
}

/**
 * Queries Google Places using multiple culinary keywords and combines results.
 *
 * @param {string} location - Location name for restaurant queries.
 * @param {string} apiKey - Google Maps API key.
 * @returns {Promise<DiningResponse>}
 */
export async function fetchRestaurants(location, apiKey) {
    const queries = [
        { source: 'Google', query: `restaurants near ${location}` },
        { source: 'Michelin', query: `michelin star restaurants near ${location}` },
        { source: 'JamesBeard', query: `james beard award restaurants near ${location}` },
        { source: 'Eater', query: `eater 38 restaurants near ${location}` }
    ];

    const results = await Promise.allSettled(
        queries.map(({ source, query }) =>
            fetchGoogleTextSearch(query, apiKey, source)
                .then(function (data) {
                    return { source, status: 'fulfilled', data };
                })
                .catch(function (error) {
                    return { source, status: 'rejected', error: error.message };
                })
        )
    );

    const fulfilled = results
        .filter(function (r) { return r.status === 'fulfilled'; })
        .map(function (r) { return r.value.data; });

    const sources = results.map(function (r) {
        return {
            source: r.value?.source || r.reason?.source || 'unknown',
            status: r.status,
            count: r.value?.data?.length || 0,
            error: r.reason?.error || undefined
        };
    });

    return {
        data: deduplicateRestaurants(fulfilled),
        sources
    };
}
