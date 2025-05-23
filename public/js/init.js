/**
 * @file init.js
 * @description Bootstraps the trip planner app: loads trips, fetches config, and wires up UI event listeners.
 */

import { renderTrip, createTripStore, setupBlurHandler } from './trip.js';

// Create and persist the trip store instance globally
const TripStore = createTripStore();

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
 * Loads a selected trip from disk and renders it.
 *
 * @param {string} tripName
 * @param {string} apiKey
 */
const loadSelectedTrip = async (tripName, apiKey) => {
    console.log('[loadSelectedTrip] tripName:', tripName);
    if (!tripName || tripName === 'new') return;

    const tripData = await fetchTripData(tripName);
    tripData.apiKey = apiKey;

    TripStore.set(tripData);
    renderTrip(tripData, apiKey, TripStore);
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
    fetchConfig,
    fetchTripList,
    fetchTripData,
    populateTripSelector,
    loadSelectedTrip,
    attachTripSelectorListener,
    enableAddDayButton
};
