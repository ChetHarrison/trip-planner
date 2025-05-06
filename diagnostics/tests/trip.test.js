import {
  setupInputHandlers,
  hydrateClassicAutocompleteInputs,
  persistAndRenderTrip,
  saveTripData,
  handleAddDay,
  handleAddActivity,
  handleDeleteDay,
  handleDeleteActivity,
  initDragAndDrop,
  renderTrip
} from '../../public/js/trip.js';

jest.mock('../../public/js/tripPure.js', () => ({
  renderTripHTML: () => '<div></div>',
  renderActivityCard: jest.fn(),
  calculateActivityTime: jest.fn()
}));

// Stub renderTrip to avoid DOM dependency during persist
let containerStub;
beforeAll(() => {
  containerStub = { innerHTML: '' };
  global.document.getElementById = jest.fn(() => containerStub);
});

function getFreshTrip() {
  return {
    trip: [
      {
        location: '',
        wakeUpTime: '',
        lodging: {
          hotel: '',
          address: '',
          phone: ''
        },
        activities: [
          {
            name: 'Museum',
            location: '',
            notes: '',
            length: 60
          }
        ]
      }
    ]
  };
}

describe('trip module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <input data-field="location" data-day-index="0" value="London" />
      <input data-field="lodging.phone" data-day-index="0" value="123-4567" />
      <input data-field="wakeUpTime" data-day-index="0" value="09:00" />
      <div data-day-index="0">
        <div data-activity-index="0" data-day-index="0"></div>
      </div>
    `;
    global.google = {
      maps: {
        places: {
          Autocomplete: jest.fn(() => ({
            addListener: jest.fn()
          }))
        }
      }
    };
  });

  test('setupInputHandlers handles autocomplete:update for flat field', () => {
    const mockEvent = new CustomEvent('autocomplete:update', {
      detail: {
        dayIndex: 0,
        field: 'location',
        value: 'London'
      }
    });
    const tripData = getFreshTrip();
    setupInputHandlers(tripData);
    document.dispatchEvent(mockEvent);
    expect(localStorage.getItem('tripData')).toContain('London');
  });

  test('setupInputHandlers handles autocomplete:update for nested day field', () => {
    const mockEvent = new CustomEvent('autocomplete:update', {
      detail: {
        dayIndex: 0,
        field: 'lodging.phone',
        value: '123-4567'
      }
    });
    const tripData = getFreshTrip();
    setupInputHandlers(tripData);
    document.dispatchEvent(mockEvent);
    expect(localStorage.getItem('tripData')).toContain('123-4567');
  });

  test('setupInputHandlers handles autocomplete:update for activity', () => {
    const mockEvent = new CustomEvent('autocomplete:update', {
      detail: {
        dayIndex: 0,
        activityIndex: 0,
        field: 'location',
        value: 'The Louvre'
      }
    });
    const tripData = getFreshTrip();
    setupInputHandlers(tripData);
    document.dispatchEvent(mockEvent);
    expect(localStorage.getItem('tripData')).toContain('The Louvre');
  });

  test('setupInputHandlers handles autocomplete:update for wakeUpTime', () => {
    const mockEvent = new CustomEvent('autocomplete:update', {
      detail: {
        dayIndex: 0,
        field: 'wakeUpTime',
        value: '09:00'
      }
    });
    const tripData = getFreshTrip();
    setupInputHandlers(tripData);
    document.dispatchEvent(mockEvent);
    expect(localStorage.getItem('tripData')).toContain('09:00');
  });

  test('hydrateClassicAutocompleteInputs attaches listeners safely', () => {
    const mockAddListener = jest.fn();

    document.body.innerHTML = `
      <input class="classic-location-autocomplete" data-day-index="0" />
      <input class="classic-hotel-autocomplete" data-day-index="0" />
      <input class="classic-activity-autocomplete" data-day-index="0" />
    `;

    global.google.maps.places.Autocomplete = jest.fn(() => ({
      addListener: mockAddListener,
      getPlace: () => ({ name: 'Mock Place' })
    }));

    hydrateClassicAutocompleteInputs('fake-key');

    expect(global.google.maps.places.Autocomplete).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    expect(mockAddListener).toHaveBeenCalledWith('place_changed', expect.any(Function));
  });

  test('persistAndRenderTrip saves and renders trip', () => {
    const trip = getFreshTrip();
    const result = persistAndRenderTrip(trip);
    expect(localStorage.getItem('tripData')).toContain('Museum');
    expect(result).toEqual(trip);
  });

  test('saveTripData stores data in localStorage', () => {
    const data = getFreshTrip();
    saveTripData(data);
    expect(JSON.parse(localStorage.getItem('tripData'))).toEqual(data);
  });

  test('handleAddDay adds a new day', () => {
    const trip = getFreshTrip();
    const result = handleAddDay(trip);
    expect(result.trip.length).toBe(2);
    expect(result.trip[1]).toMatchObject({
      location: '',
      wakeUpTime: '08:00',
      lodging: {},
      activities: []
    });
  });

  test('handleAddActivity adds a new activity to a day', () => {
    const trip = getFreshTrip();
    const result = handleAddActivity(trip, 0);
    expect(result.trip[0].activities.length).toBe(2);
    expect(result.trip[0].activities[1]).toMatchObject({
      name: '',
      length: 0,
      location: '',
      notes: ''
    });
  });

  test('handleDeleteDay removes the day at index', () => {
    const trip = getFreshTrip();
    const result = handleDeleteDay(trip, 0);
    expect(result.trip.length).toBe(0);
  });

  test('handleDeleteActivity removes activity at given index', () => {
    const trip = getFreshTrip();
    const result = handleDeleteActivity(trip, 0, 0);
    expect(result.trip[0].activities.length).toBe(0);
  });

  test('initDragAndDrop does not crash without dragula', () => {
    const originalDragula = global.dragula;
    global.dragula = undefined;
    initDragAndDrop(getFreshTrip(), persistAndRenderTrip);
    global.dragula = originalDragula;
  });

  test('renderTrip early exits when container is null', () => {
    global.document.getElementById = jest.fn(() => null);
    expect(() => renderTrip(getFreshTrip())).not.toThrow();
  });

  test('initDragAndDrop correctly reorders activities', () => {
    const tripData = getFreshTrip();
    const mockContainer = document.createElement('div');
    mockContainer.classList.add('activity-list');
    mockContainer.dataset.dayIndex = '0';

    const child = document.createElement('div');
    child.dataset.dayIndex = '0';
    child.dataset.activityIndex = '0';
    mockContainer.appendChild(child);
    document.body.appendChild(mockContainer);

    const mockDrake = { on: jest.fn((event, cb) => cb(null, mockContainer)) };
    global.dragula = jest.fn(() => mockDrake);

    const persist = jest.fn();
    initDragAndDrop(tripData, persist);

    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      trip: [expect.objectContaining({
        activities: [expect.objectContaining({ name: 'Museum' })]
      })]
    }));
  });
});
