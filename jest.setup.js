const $ = require('jquery');
global.$ = global.jQuery = $;  // Expose jQuery globally for the test environment

global.google = {
  maps: {
    places: {
      Autocomplete: jest.fn(() => ({
        addListener: jest.fn(),
      })),
    },
  },
};

global.moment = jest.fn(() => ({
  format: jest.fn(() => '8:00 AM'),
  add: jest.fn(() => this),
}));

global.dragula = jest.fn(() => ({
  on: jest.fn(),
}));