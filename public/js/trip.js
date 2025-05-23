/**
 * @file trip.js
 * @description Impure UI logic and event handlers for the trip planner app.
 */

import {
  renderTripHTML,
  renderActivityCard,
  calculateActivityTime
} from './tripPure.js';

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
  setupBlurHandler(store);
  attachButtonHandlers(store);
  handleAddDayButton(store);
  handleDeleteActivityButtons(store);
  handleDeleteDayButtons(store);
  initDragAndDrop(store);
};

export const setupBlurHandler = (store) => {
  document.removeEventListener('blur', blurListener, true);
  document.addEventListener('blur', blurListener, true);

  function blurListener(e) {
    if (!(e.target instanceof HTMLInputElement)) return;

    const input = e.target;
    const { field, dayIndex, activityIndex } = input.dataset;
    if (dayIndex == null || field == null) return;

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

    store.update(() => updatedTrip);
  }
};

export const initDragAndDrop = (store) => {
  if (typeof dragula !== 'function') return;

  const containers = Array.from(document.querySelectorAll('.activity-list'));
  const drake = dragula(containers);

  drake.on('drop', (el, target) => {
    const dayIndex = parseInt(target.dataset.dayIndex, 10);
    const updatedTrip = cloneTripWithMetadata(store.get());
    const newOrder = Array.from(target.children).map((el) => {
      const index = parseInt(el.dataset.activityIndex, 10);
      return updatedTrip.trip[dayIndex].activities[index];
    });
    updatedTrip.trip[dayIndex].activities = newOrder;
    store.update(() => updatedTrip);
  });
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
