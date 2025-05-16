// trip.js
// Impure UI logic and event handlers for the trip planner app.

import {
  renderTripHTML,
  renderActivityCard,
  calculateActivityTime
} from './tripPure.js';

/**
 * @typedef {Object} TripStore
 * @property {function(): TripData} get
 * @property {function(TripData): void} set
 * @property {function(function(TripData): TripData | Promise<TripData>): Promise<void>} update
 */

export const cloneTripWithMetadata = (tripData) => ({
  tripName: tripData.tripName,
  startDate: tripData.startDate,
  apiKey: tripData.apiKey,
  trip: structuredClone(tripData.trip)
});

export const createTripStore = () => {
  let tripData = null;
  const store = {
    get: () => tripData,
    set: (trip) => { tripData = trip; },
    update: async (updateFn) => {
      if (typeof updateFn !== 'function') throw new TypeError('[TripStore] update() requires a function');
      const result = updateFn(tripData);
      tripData = result instanceof Promise ? await result : result;
      renderTrip(tripData, tripData.apiKey, store);
      await saveTripToServer(tripData);
    }
  };
  return store;
};

export const renderTrip = (tripData, apiKey, store) => {
  const container = document.getElementById('trip-output');
  if (!container) return;

  container.innerHTML = renderTripHTML(tripData, apiKey);
  hydrateClassicAutocompleteInputs(tripData, store);
  setupBlurHandler(store);
  attachButtonHandlers(store);         // existing
  handleAddDayButton(store);          // 🆕 NEW
  handleDeleteActivityButtons(store); // 🆕 NEW
  handleDeleteDayButtons(store);
};

export const hydrateClassicAutocompleteInputs = (tripData, store) => {
  if (!window.google?.maps?.places?.Autocomplete) return;
  const selectors = [
    ['.classic-location-autocomplete', 'location'],
    ['.classic-hotel-autocomplete', 'lodging.name'],
    ['.classic-activity-autocomplete', 'location']
  ];
  selectors.forEach(([selector, field]) => {
    document.querySelectorAll(selector).forEach(input => {
      try {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const dayIndex = input.dataset.dayIndex;
          const activityIndex = input.dataset.activityIndex;
          const name = place?.name || '';
          const address = place?.formatted_address || '';
          const phone = place?.formatted_phone_number || '';
          const updatedTrip = cloneTripWithMetadata(store.get());
          const day = updatedTrip.trip[dayIndex];
          if (field === 'lodging.name') {
            day.lodging = { name, address, phone };
            input.value = name;

            const addrInput = document.querySelector(`input[data-field="lodging.address"][data-day-index="${dayIndex}"]`);
            if (addrInput) addrInput.value = address;

            const phoneInput = document.querySelector(`input[data-field="lodging.phone"][data-day-index="${dayIndex}"]`);
            if (phoneInput) phoneInput.value = phone;

          } else if (activityIndex !== undefined) {
            day.activities[activityIndex][field] = name;
            input.value = name;
          } else {
            day[field] = name;
            input.value = name;
          }

          input.dispatchEvent(new Event('change', { bubbles: true }));
          const doUpdate = () => store.update(() => updatedTrip);
          if (field === 'location') {
            fetchSuggestionsForDay(name).then(suggestions => {
              day.suggestions = suggestions;
              doUpdate();
            });
          } else {
            doUpdate();
          }
        });
      } catch (err) {
        console.error('[autocomplete] Failed:', err);
      }
    });
  });
};

export const fetchSuggestionsForDay = async (location) => {
  if (!location) return { restaurants: [], sights: [], history: '' };
  try {
    const diningRes = await fetch(`/getDiningSuggestions?location=${encodeURIComponent(location)}`);
    const sightsRes = await fetch(`/getSiteSuggestions?location=${encodeURIComponent(location)}`);
    const historyRes = await fetch(`/getLocationHistory?location=${encodeURIComponent(location)}`);
    return {
      restaurants: (await diningRes.json()).data || [],
      sights: (await sightsRes.json()).results || [],
      history: (await historyRes.json()).extract || ''
    };
  } catch (err) {
    console.error('[fetchSuggestionsForDay] Error:', err);
    return { restaurants: [], sights: [], history: '' };
  }
};

export const setupBlurHandler = (store) => {
  document.removeEventListener('blur', blurListener, true);
  document.addEventListener('blur', blurListener, true);

  async function blurListener(e) {
    if (!(e.target instanceof HTMLInputElement)) return;
    const input = e.target;
    const { field, dayIndex, activityIndex } = input.dataset;
    if (dayIndex == null || field == null || input._autocompleteJustSelected) return;

    const value = input.value;
    const updatedTrip = cloneTripWithMetadata(store.get());
    const day = updatedTrip.trip[dayIndex];
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
  }
};

export const attachButtonHandlers = (store) => {
  const container = document.getElementById('trip-output');
  if (!container) return;

  container.querySelectorAll('.add-day-button').forEach(btn => {
    if (btn._handler) btn.removeEventListener('click', btn._handler);
    btn._handler = () => {
      store.update(trip => {
        const newTrip = cloneTripWithMetadata(trip);
        newTrip.trip.push({ location: '', wakeUpTime: '08:00', lodging: {}, activities: [] });
        return newTrip;
      }).then(() => {
        const days = container.querySelectorAll('[data-day-index]');
        days[days.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    btn.addEventListener('click', btn._handler);
  });

  container.querySelectorAll('.add-activity-button').forEach(btn => {
    if (btn._handler) btn.removeEventListener('click', btn._handler);
    btn._handler = () => {
      const dayIndex = parseInt(btn.dataset.dayIndex, 10);
      store.update(trip => {
        const newTrip = cloneTripWithMetadata(trip);
        newTrip.trip[dayIndex].activities.push({ name: '', length: 0, location: '', notes: '' });
        return newTrip;
      }).then(() => {
        const list = container.querySelector(`.activity-list[data-day-index="${dayIndex}"]`);
        list?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    btn.addEventListener('click', btn._handler);
  });
};

/**
 * Hooks up all "Delete Activity" buttons and binds them to remove an activity and re-render.
 * Requires buttons with class "delete-activity-button" and dataset dayIndex + activityIndex.
 *
 * @param {TripStore} store - The centralized trip state store.
 */
export const handleDeleteActivityButtons = (store) => {
  const container = document.getElementById('trip-output');
  if (!container) return;

  container.querySelectorAll('.delete-activity-button').forEach((btn) => {
    btn.removeEventListener('click', btn._handler);
    btn._handler = () => {
      const dayIndex = parseInt(btn.dataset.dayIndex, 10);
      const activityIndex = parseInt(btn.dataset.activityIndex, 10);
      store.update((trip) => {
        const newTrip = cloneTripWithMetadata(trip);
        newTrip.trip[dayIndex].activities.splice(activityIndex, 1);
        return newTrip;
      });
    };
    btn.addEventListener('click', btn._handler);
  });
};

/**
 * Hooks up all "Delete Day" buttons to remove the day at the given index and re-render the trip.
 * Buttons must have class "delete-day-button" and data-day-index attribute.
 *
 * @param {TripStore} store - The centralized trip state store.
 */
export const handleDeleteDayButtons = (store) => {
  const container = document.getElementById('trip-output');
  if (!container) return;

  container.querySelectorAll('.delete-day-button').forEach((btn) => {
    btn.removeEventListener('click', btn._handler);
    btn._handler = () => {
      const dayIndex = parseInt(btn.dataset.dayIndex, 10);
      store.update((trip) => {
        const newTrip = cloneTripWithMetadata(trip);
        newTrip.trip.splice(dayIndex, 1);
        return newTrip;
      });
    };
    btn.addEventListener('click', btn._handler);
  });
};

/**
 * Binds the main "Add Day" button to append a new day and scroll into view.
 * Requires the button to have id="add-day-button".
 *
 * @param {TripStore} store - The centralized trip state store.
 */
export const handleAddDayButton = (store) => {
  const btn = document.getElementById('add-day-button');
  if (!btn) return;

  btn.removeEventListener('click', btn._handler);
  btn._handler = () => {
    store.update((trip) => {
      const newTrip = cloneTripWithMetadata(trip);
      newTrip.trip.push({
        location: '',
        wakeUpTime: '08:00',
        lodging: {},
        activities: []
      });
      return newTrip;
    }).then(() => {
      const lastDay = document.querySelectorAll('[data-day-index]');
      lastDay[lastDay.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  btn.addEventListener('click', btn._handler);
};

export const saveTripToServer = async (tripData) => {
  try {
    const { tripName, startDate, trip } = tripData;
    if (!tripName || !startDate || !Array.isArray(trip)) throw new Error('Missing trip metadata');
    const res = await fetch('/saveTrip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripName, startDate, trip })
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
  } catch (err) {
    console.error('[saveTripToServer]', err);
  }
};
