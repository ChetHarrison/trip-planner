/**
 * @file init.js
 * @description Bootstraps the trip planner app: loads trips, fetches config, and wires up UI event listeners.
 */

import { renderTrip, createTripStore, setupBlurHandler, fetchSuggestionsForDay } from './trip.js';

// Create and persist the trip store instance globally
const TripStore = createTripStore();

/**
 * Dynamically loads the Google Maps JavaScript API
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
const loadGoogleMapsScript = (apiKey) => new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.Autocomplete) return resolve();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.defer = true;
    script.onload = () => {
        if (window.google?.maps?.places?.Autocomplete) resolve();
        else reject(new Error('Google Maps loaded but Autocomplete not found'));
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
});

/**
 * @returns {Promise<{ googleMapsApiKey: string }>}
 */
const fetchConfig = () =>
    fetch('/config').then((res) => {
        if (!res.ok) throw new Error('Failed to load config');
        return res.json();
    });

/**
 * @returns {Promise<string[]>}
 */
const fetchTripList = () =>
    fetch('/getTrips').then((res) => {
        if (!res.ok) throw new Error('Failed to load trip list');
        return res.json();
    });

/**
 * @param {string} tripName
 * @returns {Promise<TripData>}
 */
const fetchTripData = (tripName) =>
    fetch(`/getTrip?tripName=${encodeURIComponent(tripName)}`).then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch trip: ${tripName}`);
        return res.json();
    });

/**
 * @param {string[]} tripNames
 */
const populateTripSelector = (tripNames) => {
    document.getElementById('trip-selector').innerHTML = [
        '<option value="">Select a trip</option>',
        '<option value="new">New Trip</option>',
        ...tripNames.map((name) => `<option value="${name}">${name}</option>`),
    ].join('');
};

/**
 * Loads a selected trip from disk, attaches API key, refetches suggestions, and renders.
 *
 * @param {string} tripName
 * @param {string} apiKey
 */
const loadSelectedTrip = async (tripName, apiKey) => {
    console.log('[loadSelectedTrip] tripName:', tripName);
    if (!tripName || tripName === 'new') return;

    await loadGoogleMapsScript(apiKey);
    const tripData = await fetchTripData(tripName);
    tripData.apiKey = apiKey;

    // Refetch suggestions for each day with a valid location
    const daysWithSuggestions = await Promise.all(
        tripData.trip.map(async (day) => {
            if (day.location) {
                const suggestions = await fetchSuggestionsForDay(day.location);
                return { ...day, suggestions };
            }
            return day;
        })
    );

    const enrichedTrip = { ...tripData, trip: daysWithSuggestions };

    TripStore.set(enrichedTrip);
    renderTrip(enrichedTrip, apiKey, TripStore.update);
};

/**
 * @param {string} apiKey
 */
const attachTripSelectorListener = (apiKey) => {
    document.getElementById('trip-selector')?.addEventListener('change', (e) =>
        loadSelectedTrip(e.target.value, apiKey)
    );
};

const enableAddDayButton = () => {
    document.getElementById('add-day-button').disabled = false;
};

/**
 * Main app entrypoint
 */
const initApp = async () => {
    try {
        const config = await fetchConfig();
        const tripNames = await fetchTripList();
        populateTripSelector(tripNames);
        attachTripSelectorListener(config.googleMapsApiKey);
        enableAddDayButton();
        setupBlurHandler(TripStore);
    } catch (err) {
        console.error('🚨 Error initializing app:', err);
    }
};

initApp();

export const __testHooks = {
    loadGoogleMapsScript,
    fetchConfig,
    fetchTripList,
    fetchTripData,
    populateTripSelector,
    loadSelectedTrip,
    attachTripSelectorListener,
    enableAddDayButton
};
