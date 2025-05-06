import {
  getNested,
  dataAttrs,
  formRowLabeled,
  inputField,
  renderFormField,
  calculateActivityTime,
  renderDayFields,
  renderActivityFields,
  formatSuggestionSection,
  renderActivityCard,
  calculateDate,
  renderDay,
  renderTripHTML
} from '../../public/js/tripPure.js';

describe('tripPure module', () => {
  const day = {
    wakeUpTime: '08:00',
    location: 'Paris',
    lodging: {
      name: 'Hotel Test',
      address: '123 Street',
      phone: '555-5555',
      roomType: 'Suite'
    },
    activities: [
      { name: 'Museum', length: 60, location: 'Louvre', notes: 'Buy tickets online' },
      { name: 'Lunch', length: 90, location: 'Cafe', notes: 'Reservation at 1PM' }
    ],
    suggestions: {
      restaurants: [{ name: 'Chez Panisse', formatted_address: '123 Elm St' }],
      sights: [{ name: 'Eiffel Tower', formatted_address: 'Champ de Mars' }],
      history: 'Historical info'
    }
  };

  test('getNested retrieves nested values correctly', () => {
    expect(getNested(day, 'lodging.name')).toBe('Hotel Test');
    expect(getNested(day, 'lodging.nonexistent')).toBeUndefined();
  });

  test('dataAttrs formats data attributes', () => {
    expect(dataAttrs({ foo: 'bar', id: 5 })).toBe('data-foo="bar" data-id="5"');
  });

  test('formRowLabeled wraps HTML with a label row', () => {
    const wrap = formRowLabeled('MyLabel');
    expect(wrap('<input>')).toContain('MyLabel');
    expect(wrap('<input>')).toContain('<input>');
  });

  test('inputField generates input and textarea fields', () => {
    expect(inputField('text', { value: 'abc' })).toContain('value="abc"');
    expect(inputField('textarea', { value: 'abc' })).toContain('<textarea');
  });

  test('renderFormField includes label and value', () => {
    const html = renderFormField('Name', 'text', 'Alice');
    expect(html).toContain('Name');
    expect(html).toContain('Alice');
  });

  test('calculateActivityTime returns correct cumulative time', () => {
    expect(calculateActivityTime(day, 0)).toMatch(/08:00/);
    expect(calculateActivityTime(day, 1)).toMatch(/09:00/);
  });

  test('renderDayFields returns all expected fields', () => {
    const html = renderDayFields(day, 0);
    expect(html).toContain('wakeUpTime');
    expect(html).toContain('Hotel Name');
    expect(html).toContain('Location');
  });

  test('renderActivityFields returns all expected fields', () => {
    const html = renderActivityFields(day.activities[0], 0, 0);
    expect(html).toContain('Name');
    expect(html).toContain('Length');
    expect(html).toContain('Notes');
  });

  test('formatSuggestionSection returns suggestions block', () => {
    const html = formatSuggestionSection(day.suggestions, 'Paris', 'XYZ');
    expect(html).toContain('Top 5 Restaurants');
    expect(html).toContain('Top 5 Tourist Sights');
    expect(html).toContain('History of Paris');
  });

  test('renderActivityCard returns HTML with activity name and time', () => {
    const html = renderActivityCard(day.activities[0], 0, 0, '08:00 AM');
    expect(html).toContain('08:00 AM');
    expect(html).toContain('Museum');
    expect(html).toContain('Delete Activity');
  });

  test('calculateDate formats the date string', () => {
    expect(calculateDate('2025-01-01', 0)).toBe('Wednesday, January 1st 2025');
    expect(calculateDate('2025-01-01', 1)).toBe('Thursday, January 2nd 2025');
  });

  test('renderDay returns combined print and form HTML', () => {
    const html = renderDay(day, 0, 'Trip Title', 'Friday, January 3rd 2025', 'XYZ');
    expect(html).toContain('Trip Title');
    expect(html).toContain('Paris');
    expect(html).toContain('Hotel Test');
    expect(html).toContain('Delete Day');
  });

  test('renderTripHTML renders full trip HTML', () => {
    const trip = {
      tripName: 'Test Trip',
      startDate: '2025-01-01',
      trip: [day]
    };
    const html = renderTripHTML(trip);
    expect(html).toContain('Test Trip');
    expect(html).toContain('Museum');
    expect(html).toContain('Delete Day');
  });
});
