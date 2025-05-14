/**
 * @file trip.js
 * @description Impure UI logic and event handlers for the trip planner app.
 * Centralizes trip state with TripStore and hydrates UI interactions.
 */

import {
    renderTripHTML,
    renderActivityCard,
    calculateActivityTime
} from './tripPure.js';

/**
 * Creates a deep clone of the trip object, preserving tripName and startDate metadata.
 *
 * @param {TripData} tripData - The full trip object to clone.
 * @returns {TripData} A cloned object with tripName, startDate, and a deep copy of trip[]
 */
export const cloneTripWithMetadata = (tripData) => ({
    tripName: tripData.tripName,
    startDate: tripData.startDate,
    trip: structuredClone(tripData.trip)
});

/**
 * Creates a centralized TripStore to manage in-memory trip state, trigger UI rendering,
 * and persist changes to the server.
 *
 * @returns {Object} TripStore instance with get, set, and update methods.
 */
export const createTripStore = () => {
    let tripData = null;

    const store = {
        get: () => tripData,

        set: (trip) => {
            tripData = trip;
        },

        update: async (updateFunction) => {
            if (typeof updateFunction !== 'function') {
                throw new TypeError('[TripStore] update() expects a function');
            }

            const result = updateFunction(tripData);
            tripData = result instanceof Promise ? await result : result;

            renderTrip(tripData, tripData.apiKey, store.update);
            await saveTripToServer(tripData);
        }
    };

    return store;
};

/**
 * Renders the entire trip UI and attaches Google Maps autocomplete listeners.
 *
 * @param {TripData} tripData - The current trip data to render.
 * @param {string} apiKey - Google Maps API key.
 * @param {Function} updateTrip - Function to update the trip state and trigger persistence.
 */
export const renderTrip = (tripData, apiKey, updateTrip) => {
    const container = document.getElementById('trip-output');
    if (!container) {
        console.warn('[renderTrip] No container element with id #trip-output found.');
        return;
    }

    container.innerHTML = renderTripHTML(tripData, apiKey);

    hydrateClassicAutocompleteInputs(tripData, {
        get: () => tripData,
        update: updateTrip
    });
};

/**
 * Attaches Google Maps Autocomplete to hotel, activity, and day location fields.
 * When a place is selected, updates relevant trip fields and UI inputs.
 * Special-case: if location is changed, fetches new dining/sight/history suggestions.
 *
 * @param {TripData} tripData - Full trip object with tripName, startDate, and trip[]
 * @param {{
 *   get: () => TripData,
 *   update: (updateFn: (TripData) => TripData | Promise<TripData>) => void
 * }} store - The TripStore instance for managing trip state
 */
export const hydrateClassicAutocompleteInputs = (tripData, store) => {
    if (!window.google?.maps?.places?.Autocomplete) {
        console.warn('[autocomplete] Google Maps Autocomplete is not available.');
        return;
    }

    const selectors = [
        ['.classic-location-autocomplete', 'location'],
        ['.classic-hotel-autocomplete', 'lodging.name'],
        ['.classic-activity-autocomplete', 'location']
    ];

    selectors.forEach(([selector, field]) => {
        document.querySelectorAll(selector).forEach((input) => {
            try {
                const autocomplete = new google.maps.places.Autocomplete(input);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    const dayIndex = input.dataset.dayIndex;
                    const activityIndex = input.dataset.activityIndex;

                    if (!tripData?.trip?.[dayIndex]) return;

                    input._autocompleteJustSelected = true;

                    const name = place?.name || '';
                    const address = place?.formatted_address || '';
                    const phone = place?.formatted_phone_number || '';

                    const updatedTrip = cloneTripWithMetadata(store.get());
                    const day = updatedTrip.trip[dayIndex];

                    if (field === 'lodging.name') {
                        day.lodging = { name, address, phone };
                        input.value = name;

                        const addrInput = document.querySelector(`input[data-field="lodging.address"][data-day-index="${dayIndex}"]`);
                        const phoneInput = document.querySelector(`input[data-field="lodging.phone"][data-day-index="${dayIndex}"]`);
                        if (addrInput) addrInput.value = address;
                        if (phoneInput) phoneInput.value = phone;

                    } else if (activityIndex !== undefined) {
                        day.activities[activityIndex][field] = name;
                        input.value = name;
                    } else {
                        day[field] = name;
                        input.value = name;
                    }

                    input.dispatchEvent(new Event('change', { bubbles: true }));

                    if (field === 'location') {
                        fetchSuggestionsForDay(name).then((suggestions) => {
                            day.suggestions = suggestions;
                            store.update(() => updatedTrip);
                        });
                    } else {
                        store.update(() => updatedTrip);
                    }

                    setTimeout(() => {
                        delete input._autocompleteJustSelected;
                    }, 0);
                });
            } catch (err) {
                console.error('[autocomplete] Failed to initialize:', err);
            }
        });
    });
};

/**
 * @typedef {Object} SuggestionResult
 * @property {Restaurant[]} restaurants
 * @property {Object[]} sights
 * @property {string} history
 */

/**
 * Fetches dining, sights, and history suggestions for a given location.
 *
 * @param {string} location - The name of the location to fetch suggestions for.
 * @returns {Promise<SuggestionResult>} - Combined results from dining, sightseeing, and Wikipedia.
 */
export async function fetchSuggestionsForDay(location) {
    if (!location) {
        return { restaurants: [], sights: [], history: '' };
    }

    try {
        const diningRes = await fetch(`/getDiningSuggestions?location=${encodeURIComponent(location)}`);
        const sightsRes = await fetch(`/getSiteSuggestions?location=${encodeURIComponent(location)}`);
        const historyRes = await fetch(`/getLocationHistory?location=${encodeURIComponent(location)}`);

        const dining = await diningRes.json();
        const sights = await sightsRes.json();
        const history = await historyRes.json();

        console.log('[fetchSuggestionsForDay] dining response:', dining);

        return {
            restaurants: dining.data || [],
            sights: sights.results || [],
            history: history.extract || ''
        };
    } catch (err) {
        console.error('[fetchSuggestionsForDay] Error:', err);
        return { restaurants: [], sights: [], history: '' };
    }
}

/**
 * Sets up blur listeners on inputs to persist data changes.
 *
 * @param {Object} store - TripStore with get and update.
 */
export const setupBlurHandler = (store) => {
    document.addEventListener('blur', async (e) => {
        if (!(e.target instanceof HTMLInputElement)) return;

        const input = e.target;
        const { field, dayIndex, activityIndex } = input.dataset;
        if (dayIndex == null || field == null || input._autocompleteJustSelected) return;

        const value = input.value;
        const updatedTrip = cloneTripWithMetadata(store.get());
        const day = updatedTrip.trip?.[dayIndex];
        if (!day) return;

        if (activityIndex !== undefined) {
            day.activities[activityIndex][field] = value;
        } else {
            const [outer, inner] = field.split('.');
            if (inner) {
                day[outer] ||= {};
                day[outer][inner] = value;
            } else {
                day[field] = value;
            }
        }

        store.update(async () => {
            const newTrip = structuredClone(updatedTrip);
            if (field === 'location') {
                newTrip.trip[dayIndex].suggestions = await fetchSuggestionsForDay(value);
            }
            return newTrip;
        });
    }, true);
};

/**
 * Sends the trip object to the server for persistence.
 *
 * @param {TripData} tripData - Full trip object.
 */
export const saveTripToServer = async (tripData) => {
    try {
        const { tripName, startDate, trip } = tripData;
        if (!tripName || !startDate || !Array.isArray(trip)) {
            throw new Error('[saveTripToServer] Missing tripName, startDate, or trip array.');
        }

        const response = await fetch('/saveTrip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tripName, startDate, trip })
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        console.log('[saveTripToServer] Trip saved successfully.');
    } catch (error) {
        console.error('[saveTripToServer] Failed to save trip:', error);
    }
};
