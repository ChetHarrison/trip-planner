/**
 * @file init.js
 * @description Bootstraps the trip planner app: loads trips, fetches config, and wires up UI event listeners.
 */

import { renderTrip, hydrateClassicAutocompleteInputs } from './trip.js';

/**
 * Dynamically loads the Google Maps JavaScript API
 * @param {string} apiKey - Your Google Maps API key
 * @returns {Promise<void>}
 */
const loadGoogleMapsScript = (apiKey) =>
    new Promise((resolve, reject) => {
        if (window.google && window.google.maps) return resolve();

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Google Maps API'));
        document.head.appendChild(script);
    });

/**
 * Fetch Google Maps API key and other config
 * @returns {Promise<{ googleMapsApiKey: string }>}
 */
const fetchConfig = () =>
    fetch('/config').then(res => {
        if (!res.ok) throw new Error('Failed to load config');
        return res.json();
    });

/**
 * Fetch list of saved trip filenames
 * @returns {Promise<string[]>}
 */
const fetchTripList = () =>
    fetch('/getTrips').then(res => {
        if (!res.ok) throw new Error('Failed to load trip list');
        return res.json();
    });

/**
 * Fetch a specific trip by name
 * @param {string} tripName
 * @returns {Promise<TripData>}
 */
const fetchTripData = (tripName) =>
    fetch(`/getTrip?tripName=${encodeURIComponent(tripName)}`).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch trip: ${tripName}`);
        return res.json();
    });

/**
 * Renders options inside the trip <select> element.
 * @param {string[]} tripNames - Array of saved trip names
 * @returns {void}
 */
const populateTripSelector = (tripNames) =>
    (document.getElementById('trip-selector').innerHTML =
        ['<option value="">Select a trip</option>', '<option value="new">New Trip</option>']
            .concat(tripNames.map(name => `<option value="${name}">${name}</option>`))
            .join(''));

/**
 * Handles trip selection from dropdown
 * @param {string} tripName
 * @param {string} apiKey
 */
const loadSelectedTrip = async (tripName, apiKey) => {
    if (!tripName || tripName === 'new') return;

    await loadGoogleMapsScript(apiKey);
    const tripData = await fetchTripData(tripName);
    renderTrip(tripData, apiKey);
    hydrateClassicAutocompleteInputs(apiKey);
};

/**
 * Initializes trip selector listener.
 * @param {string} apiKey - Google Maps API key
 * @returns {void}
 */
const attachTripSelectorListener = (apiKey) =>
    document.getElementById('trip-selector')?.addEventListener('change', (e) =>
        loadSelectedTrip(e.target.value, apiKey)
    );

/**
 * Enables the "Add Day" button.
 * @returns {void}
 */
const enableAddDayButton = () =>
    (document.getElementById('add-day-button').disabled = false);

/**
 * Main initializer
 */
const initApp = async () => {
    try {
        const config = await fetchConfig();
        const tripNames = await fetchTripList();

        populateTripSelector(tripNames);
        attachTripSelectorListener(config.googleMapsApiKey);
        enableAddDayButton();
    } catch (err) {
        console.error('🚨 Error initializing app:', err);
    }
};

// Bootstrap
initApp();

// Export for test coverage
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
