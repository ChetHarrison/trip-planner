/**
 * @jest-environment jsdom
 */

beforeEach(() => {
  document.body.innerHTML = `
    <select id="trip-selector"></select>
    <button id="add-day-button" disabled>Add Day</button>
  `;

  // Clear require cache so each test gets a fresh module instance
  jest.resetModules();

  // Reset global mocks
  global.fetch = undefined;
  global.document.createElement = undefined;
  global.document.head.appendChild = undefined;
  window.google = undefined;
});

test('loadGoogleMapsScript resolves immediately if already loaded', async () => {
  window.google = { maps: {} };

  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.loadGoogleMapsScript('fake-key')).resolves.toBeUndefined();
});

test('loadGoogleMapsScript appends script if not already loaded', async () => {
  window.google = undefined;
  const scriptMock = {};
  document.createElement = jest.fn(() => scriptMock);
  document.head.appendChild = jest.fn();
  setTimeout(() => scriptMock.onload(), 0);

  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.loadGoogleMapsScript('fake-key')).resolves.toBeUndefined();
  expect(document.createElement).toHaveBeenCalledWith('script');
  expect(document.head.appendChild).toHaveBeenCalledWith(scriptMock);
});

test('fetchConfig throws on bad response', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.fetchConfig()).rejects.toThrow('Failed to load config');
});

test('fetchTripList throws on bad response', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.fetchTripList()).rejects.toThrow('Failed to load trip list');
});

test('fetchTripData throws on bad response', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.fetchTripData('Paris')).rejects.toThrow('Failed to fetch trip: Paris');
});

test('populateTripSelector renders dropdown options', async () => {
  const { __testHooks } = await import('../../public/js/init.js');
  __testHooks.populateTripSelector(['Trip A', 'Trip B']);
  const html = document.getElementById('trip-selector').innerHTML;
  expect(html).toMatch(/Trip A/);
  expect(html).toMatch(/Trip B/);
});

test('loadSelectedTrip exits early for "new"', async () => {
  const { __testHooks } = await import('../../public/js/init.js');
  await expect(__testHooks.loadSelectedTrip('new', 'fake-key')).resolves.toBeUndefined();
});

test('loadSelectedTrip fetches and renders trip', async () => {
  const mockTrip = { name: 'Mock Trip' };

  // Mock global.fetch to return mockTrip
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockTrip)
    })
  );

  // Mock render/hydrate calls BEFORE import
  const mockRenderTrip = jest.fn();
  const mockHydrate = jest.fn();

  jest.unmock('../../public/js/trip.js');
  jest.mock('../../public/js/trip.js', () => ({
    renderTrip: mockRenderTrip,
    hydrateClassicAutocompleteInputs: mockHydrate
  }));

  // ✅ MOCK document.createElement and .head.appendChild
  const mockScript = { defer: true };
  document.createElement = jest.fn(() => mockScript);
  document.head.appendChild = jest.fn(() => {
    // Immediately trigger onload to simulate successful script load
    setTimeout(() => mockScript.onload(), 0);
  });

  // Now import and call
  const { __testHooks } = await import('../../public/js/init.js');
  await __testHooks.loadSelectedTrip('Trip A', 'fake-key');

  expect(mockRenderTrip).toHaveBeenCalledWith(mockTrip, 'fake-key');
  expect(mockHydrate).toHaveBeenCalledWith('fake-key');
});

test('attachTripSelectorListener adds listener', async () => {
  const listener = jest.fn();
  const select = document.getElementById('trip-selector');
  select.addEventListener = listener;

  const { __testHooks } = await import('../../public/js/init.js');
  __testHooks.attachTripSelectorListener('abc');
  expect(listener).toHaveBeenCalledWith('change', expect.any(Function));
});

test('enableAddDayButton enables the button', async () => {
  const btn = document.getElementById('add-day-button');
  expect(btn.disabled).toBe(true);

  const { __testHooks } = await import('../../public/js/init.js');
  __testHooks.enableAddDayButton();
  expect(btn.disabled).toBe(false);
});
