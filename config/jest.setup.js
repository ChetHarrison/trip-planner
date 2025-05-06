const moment = require('moment');

// Use real moment if your code relies on its logic
global.moment = moment;

// Optional: mock moment if you're just formatting consistently in tests
// global.moment = jest.fn(() => ({
//   format: jest.fn(() => "8:00 AM"),
//   add: jest.fn(() => this),
// }));

// Polyfill for fetch (used by saveTripData)
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
  })
);

// Polyfill for structuredClone (used in deep copying test objects)
global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));

// Mocks for dragula
global.dragula = jest.fn(() => ({
  on: jest.fn(),
}));

// Mocks for Google Maps Autocomplete
global.google = {
  maps: {
    places: {
      Autocomplete: jest.fn(() => ({
        addListener: jest.fn(),
      })),
    },
  },
};

// Optional: suppress console logs during test output
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
