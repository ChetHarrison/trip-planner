/**
 * @file trip.js
 * @description Impure UI logic and event handlers for the trip planner app.
 * Handles DOM manipulation, drag-and-drop, and input synchronization.
 * @module trip
 */

import {
    renderTripHTML,
    renderActivityCard,
    calculateActivityTime
} from './tripPure.js';

/**
 * Persist trip data in local storage.
 * @param {TripData} data
 */
export const saveTripData = (data) =>
    localStorage.setItem('tripData', JSON.stringify(data));

/**
 * Save and re-render the trip.
 * @param {TripData} tripData
 * @returns {TripData}
 */
export const persistAndRenderTrip = (tripData) => {
    saveTripData(tripData);
    renderTrip(tripData);
    return tripData;
};

/**
 * Render trip HTML and bind interaction handlers.
 * @param {TripData} tripData
 * @param {string} apiKey
 */
export const renderTrip = (tripData, apiKey = '') => {
    const container = document.getElementById('days-container');
    if (!container || !tripData) return;
    container.innerHTML = renderTripHTML(tripData, apiKey);
    setupInputHandlers(tripData, apiKey);
    initDragAndDrop(tripData, persistAndRenderTrip);
};

/**
 * Hydrates Google Places Autocomplete inputs on the page.
 *
 * This function looks for specific input fields (classic-location-autocomplete,
 * classic-hotel-autocomplete, classic-activity-autocomplete) and applies
 * Google Maps Autocomplete behavior to them. When a place is selected, it dispatches
 * a custom event (`autocomplete:update`) with the selected value and context indices.
 *
 * @param {string} apiKey - Google Maps API key used to initialize autocomplete.
 */
export const hydrateClassicAutocompleteInputs = (apiKey) => {
    const selectors = [
        ['.classic-location-autocomplete', 'location'],
        ['.classic-hotel-autocomplete', 'lodging.name'],
        ['.classic-activity-autocomplete', 'location'],
    ];

    selectors.forEach(([selector, field]) => {
        document.querySelectorAll(selector).forEach((el) => {
            const autocomplete = new google.maps.places.Autocomplete(el);
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                const dayIndex = el.dataset.dayIndex;
                const activityIndex = el.dataset.activityIndex;
                const event = new CustomEvent('autocomplete:update', {
                    detail: { field, value: place.name, dayIndex, activityIndex },
                });
                document.dispatchEvent(event);
            });
        });
    });
};

/**
 * Add a new empty day to the trip.
 * @param {TripData} trip
 * @returns {TripData}
 */
export const handleAddDay = (trip) =>
    persistAndRenderTrip({
        ...trip,
        trip: [
            ...trip.trip,
            { location: '', wakeUpTime: '08:00', lodging: {}, activities: [] }
        ]
    });

/**
 * Add a blank activity to a given day.
 * @param {TripData} trip
 * @param {number} dayIndex
 * @returns {TripData}
 */
export const handleAddActivity = (trip, dayIndex) =>
    persistAndRenderTrip({
        ...trip,
        trip: trip.trip.map((day, i) =>
            i === dayIndex
                ? {
                    ...day,
                    activities: [
                        ...day.activities,
                        { name: '', length: 0, location: '', notes: '' }
                    ]
                }
                : day
        )
    });

/**
 * Delete a day from the trip.
 * @param {TripData} trip
 * @param {number} dayIndex
 * @returns {TripData}
 */
export const handleDeleteDay = (trip, dayIndex) =>
    persistAndRenderTrip({
        ...trip,
        trip: trip.trip.filter((_, i) => i !== dayIndex)
    });

/**
 * Delete an activity from a given day.
 * @param {TripData} trip
 * @param {number} dayIndex
 * @param {number} activityIndex
 * @returns {TripData}
 */
export const handleDeleteActivity = (trip, dayIndex, activityIndex) =>
    persistAndRenderTrip({
        ...trip,
        trip: trip.trip.map((day, i) =>
            i === dayIndex
                ? {
                    ...day,
                    activities: day.activities.filter((_, j) => j !== activityIndex)
                }
                : day
        )
    });

/**
 * Initialize drag-and-drop behavior for activities using Dragula.
 * Reorders activities without affecting suggestions/maps.
 * @param {TripData} tripData - The original trip data
 * @param {function} persistAndRender - Function to persist and re-render the updated trip
 */
export const initDragAndDrop = (tripData, persistAndRender) => {
    if (!window.dragula) return;

    const lists = Array.from(document.querySelectorAll('.activity-list'));
    const drake = dragula(lists);

    drake.on('drop', (_, target) => {
        const dayIndex = parseInt(target.dataset.dayIndex, 10);
        if (isNaN(dayIndex)) return;

        // Rebuild the activity order based on DOM
        const newActivities = Array.from(target.children).map(el => {
            const originalDay = parseInt(el.dataset.dayIndex, 10);
            const activityIndex = parseInt(el.dataset.activityIndex, 10);
            return structuredClone(tripData.trip[originalDay].activities[activityIndex]);
        });

        // Create a shallow copy of the trip and only update the activity order
        const updatedTrip = {
            ...tripData,
            trip: tripData.trip.map((day, i) =>
                i === dayIndex
                    ? { ...day, activities: newActivities } // keeps all other day fields like suggestions
                    : day
            )
        };

        persistAndRender(updatedTrip);
    });
};

/**
 * Setup input field change and autocomplete synchronization.
 * @param {TripData} tripData
 * @param {string} apiKey
 */
export function setupInputHandlers(tripData, apiKey) {
    document.addEventListener('autocomplete:update', (e) => {
        const { field, value, dayIndex, activityIndex } = e.detail;
        const updatedTrip = [...tripData.trip];

        if (typeof activityIndex !== 'undefined') {
            updatedTrip[dayIndex].activities[activityIndex][field] = value;
        } else {
            const parts = field.split('.');
            if (parts.length === 2) {
                const [outer, inner] = parts;
                updatedTrip[dayIndex][outer] ||= {};
                updatedTrip[dayIndex][outer][inner] = value;
            } else {
                updatedTrip[dayIndex][field] = value;
            }
        }

        persistAndRenderTrip({ ...tripData, trip: updatedTrip });
    });

    // More change handlers can be added here.
}
