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
 * Creates a centralized TripStore to manage in-memory trip state and keep server in sync.
 * @returns {{ get: () => TripData, set: (trip: TripData) => void, update: (fn: (TripData) => TripData) => void }}
 */
export const createTripStore = () => {
	let tripData = null;

	const store = {
		get: () => tripData,

		set: (trip) => {
			tripData = trip;
		},

		update: (updateFn) => {
			if (typeof updateFn !== 'function') {
				throw new TypeError('[TripStore] update() expects a function');
			}

			tripData = updateFn(tripData);
			renderTrip(tripData, tripData.apiKey, store.update);
			saveTripToServer(tripData);
		}
	};

	return store;
};

/**
 * Renders the trip UI and sets up Google Maps Autocomplete handlers.
 * @param {TripData} tripData - Current trip state to render
 * @param {string} apiKey - Google Maps API key
 * @param {(updatedTrip: TripData) => void} onTripUpdate - Callback invoked with updated trip
 */
export const renderTrip = (tripData, apiKey, onTripUpdate) => {
	const container = document.getElementById('trip-output');
	if (!container) {
		console.warn('[renderTrip] No container element with id #trip-output found.');
		return;
	}

	container.innerHTML = renderTripHTML(tripData, apiKey);

	hydrateClassicAutocompleteInputs(tripData, ({ field, place, input, dayIndex, activityIndex }) => {
		const name = place?.name || '';
		const address = place?.formatted_address || '';
		const phone = place?.formatted_phone_number || '';

		if (!input || !field) return;

		const updatedTrip = structuredClone(tripData);
		const day = updatedTrip.trip?.[dayIndex];
		if (!day) return;

		if (field === 'lodging.name') {
			day.lodging = { name, address, phone };
			input.value = name;

			const wrapper = input.closest('.day-entry') || input.closest('.card');
			const addressInput = wrapper && wrapper.querySelector('[data-field="lodging.address"]');
			if (addressInput) addressInput.value = address;
			const phoneInput = wrapper && wrapper.querySelector('[data-field="lodging.phone"]');
			if (phoneInput) phoneInput.value = phone;
		} else if (activityIndex !== undefined) {
			day.activities[activityIndex][field] = name;
			input.value = name;
		} else {
			day[field] = name;
			input.value = name;
		}

		input.dispatchEvent(new Event('change', { bubbles: true }));
		onTripUpdate(() => updatedTrip); // ✅ pass a function that returns the object
	});
};

/**
 * Hydrates classic autocomplete fields.
 * @param {TripData} tripData
 * @param {(args: PlaceSelectedArgs) => void} onPlaceSelected
 */
export const hydrateClassicAutocompleteInputs = (tripData, onPlaceSelected = () => {}) => {
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
					onPlaceSelected({ field, place, input, dayIndex, activityIndex });
				});
			} catch (err) {
				console.error('[autocomplete] Failed to initialize:', err);
			}
		});
	});
};

/**
 * Attaches a blur handler that persists updates to trip fields when input loses focus.
 * @param {{ get: () => TripData, update: (fn: (TripData) => TripData) => void }} store - TripStore instance
 */
export const setupBlurHandler = (store) => {
	document.addEventListener('blur', (e) => {
		if (!(e.target instanceof HTMLInputElement)) return;

		const { field, dayIndex, activityIndex } = e.target.dataset;
		if (dayIndex == null || field == null) return;

		const value = e.target.value;
		const updatedTrip = structuredClone(store.get());
		const day = updatedTrip.trip?.[dayIndex];
		if (!day) return;

		if (typeof activityIndex !== 'undefined') {
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

		store.update(() => updatedTrip);
  }, true); // Use capture phase
};

/**
 * Saves the current trip data to the server.
 * @param {TripData} tripData - The full trip data object to persist
 * @returns {Promise<void>}
 */
export const saveTripToServer = async (tripData) => {
	try {
		const response = await fetch('/saveTrip', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tripData)
		});

		if (!response.ok) {
			throw new Error(`Server responded with ${response.status}`);
		}

		console.log('[saveTripToServer] Trip saved successfully.');
	} catch (error) {
		console.error('[saveTripToServer] Failed to save trip:', error);
	}
};
