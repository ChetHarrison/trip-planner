/**
 * @file tripPure.js
 * @description Pure rendering utilities for the trip planner UI.
 * Includes form generators, suggestion rendering, and full day layout generation.
 * Declarative, point-free, and fully testable.
 */

/**
 * @typedef {Object} Activity
 * @property {string} name
 * @property {number} length
 * @property {string} location
 * @property {string} notes
 */

/**
 * @typedef {Object} Lodging
 * @property {string} name
 * @property {string} address
 * @property {string} phone
 * @property {string} roomType
 */

/**
 * @typedef {Object} Day
 * @property {string} wakeUpTime
 * @property {string} location
 * @property {Lodging} lodging
 * @property {Activity[]} activities
 * @property {Object} suggestions
 * @property {Array<Object>} suggestions.restaurants
 * @property {Array<Object>} suggestions.sights
 * @property {string} suggestions.history
 */

/**
 * @typedef {Object} TripData
 * @property {string} tripName
 * @property {string} startDate
 * @property {Day[]} trip
 */

import moment from 'moment';

/**
 * Safely access nested object values by path.
 * @param {Object} obj
 * @param {string} path - e.g. 'lodging.name'
 * @returns {*}
 */
export const getNested = (obj, path) =>
    path.split('.').reduce((acc, key) => acc?.[key], obj);

/**
 * Builds HTML data attributes from a dictionary.
 * @param {Object} attrs
 * @returns {string}
 */
export const dataAttrs = (attrs = {}) =>
    Object.entries(attrs)
        .map(([k, v]) => `data-${k}="${v}"`)
        .join(' ');

/**
 * Formats a form field with a label.
 * @param {string} label - The label for the form row
 * @returns {function} A function that wraps input HTML in a Bootstrap row
 */
export const formRowLabeled = (label) => (html) => `
  <div class="row mb-2">
    <label class="col-2 col-form-label">${label}</label>
    <div class="col-10">${html}</div>
  </div>`;

/**
 * Renders a standard input or textarea field.
 * @param {string} type - The input type (e.g., "text", "textarea")
 * @param {Object} [options={}] - Optional attributes for the input
 * @param {string} [options.className]
 * @param {string|number} [options.value]
 * @param {string} [options.placeholder]
 * @param {Object} [options.dataAttrs]
 * @returns {string} The HTML string for the input field
 */
export const inputField = (
    type,
    { className = '', value = '', placeholder = '', dataAttrs: attrs = {} } = {}
) =>
    type === 'textarea'
        ? `<textarea class="form-control ${className}" rows="2" ${dataAttrs(attrs)}>${value}</textarea>`
        : `<input type="${type}" class="form-control ${className}" value="${value}" placeholder="${placeholder}" ${dataAttrs(attrs)}>`;

/**
 * Renders a form row with label and input.
 * @param {string} label - Field label
 * @param {string} type - Input type
 * @param {string|number} value - Value of the field
 * @param {string} [className] - Optional class name
 * @param {string} [placeholder] - Optional placeholder
 * @param {Object} [dataAttrs] - Data attributes to attach
 * @returns {string}
 */
export const renderFormField = (
    label,
    type,
    value,
    className = '',
    placeholder = '',
    dataAttrs = {}
) => formRowLabeled(label)(inputField(type, { className, value, placeholder, dataAttrs }));

/**
 * Generates the timestamp for an activity.
 * @param {Day} day
 * @param {number} activityIndex
 * @returns {string}
 */
export const calculateActivityTime = (day, activityIndex) => {
    const [hours, minutes] = (day.wakeUpTime || '08:00').split(':').map(Number);
    const time = new Date();
    time.setHours(hours, minutes, 0, 0);

    for (let i = 0; i < activityIndex; i++) {
        const len = parseInt(day.activities[i]?.length || 0, 10);
        time.setMinutes(time.getMinutes() + (isNaN(len) ? 0 : len));
    }

    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Field config metadata for days.
 */
const dayFieldConfigs = [
    { label: 'Start Time', type: 'text', key: 'wakeUpTime', className: 'wake-up-time', placeholder: '08:00' },
    { label: 'Location', type: 'text', key: 'location', className: 'day-location', placeholder: 'Search location...' },
    { label: 'Hotel Name', type: 'text', key: 'lodging.name', className: 'hotel-name', placeholder: 'Search hotel...' },
    { label: 'Address', type: 'text', key: 'lodging.address', placeholder: 'Hotel address' },
    { label: 'Phone', type: 'text', key: 'lodging.phone', placeholder: 'Hotel phone' },
    { label: 'Room Type', type: 'text', key: 'lodging.roomType', placeholder: 'Room type' },
];

/**
 * Field config metadata for activities.
 */
const activityFieldConfigs = [
    { label: 'Name', type: 'text', key: 'name' },
    { label: 'Length (min)', type: 'number', key: 'length', className: 'activity-length' },
    { label: 'Location', type: 'text', key: 'location', className: 'activity-location', placeholder: 'Search location...' },
    { label: 'Notes', type: 'textarea', key: 'notes' }
];

/**
 * Renders form fields for a day.
 * @param {Day} day
 * @param {number} dayIndex
 * @returns {string}
 */
export const renderDayFields = (day, dayIndex) =>
    dayFieldConfigs
        .map(({ label, type, key, className = '', placeholder = '' }) =>
            renderFormField(label, type, getNested(day, key) || '', className, placeholder, {
                'day-index': dayIndex,
                field: key,
            })
        )
        .join('');

/**
 * Renders form fields for an activity.
 * @param {Activity} activity
 * @param {number} dayIndex
 * @param {number} activityIndex
 * @returns {string}
 */
export const renderActivityFields = (activity, dayIndex, activityIndex) =>
    activityFieldConfigs
        .map(({ label, type, key, className = '', placeholder = '' }) =>
            renderFormField(label, type, activity[key] || '', className, placeholder, {
                'day-index': dayIndex,
                'activity-index': activityIndex,
                field: key,
            })
        )
        .join('');

/**
 * Formats restaurant, sights, and history section.
 * @param {Object} suggestions
 * @param {string} location
 * @param {string} apiKey
 * @returns {string}
 */
export const formatSuggestionSection = (suggestions, location, apiKey) => {
    const formatCardsRow = (label, list) =>
        list?.length
            ? `<h5 class="mt-3">${label}</h5>
         <div class="d-flex flex-wrap gap-2 mb-3">
           ${list.map(p => `
             <div style="flex: 1 1 calc(20% - 10px); min-width: 200px;">
               <strong>${p.name}</strong><br>
               ${p.formatted_address}<br>
               ${p.place_id && apiKey
        ? `<iframe width="100%" height="200" frameborder="0" style="margin-top:5px"
                     src="https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${p.place_id}"
                     allowfullscreen></iframe>`
        : ''}</div>`).join('')}
         </div>`
            : '';

    return `
    <div class="day-info-section">
      ${formatCardsRow("Top 5 Restaurants Nearby", suggestions?.restaurants || [])}
      ${formatCardsRow("Top 5 Tourist Sights", suggestions?.sights || [])}
      ${suggestions?.history ? `<div class="mt-4"><h5>History of ${location}</h5><p>${suggestions.history}</p></div>` : ''}
    </div>`;
};

/**
 * Renders a single activity card.
 * @param {Activity} activity
 * @param {number} dayIndex
 * @param {number} activityIndex
 * @param {string} time
 * @returns {string}
 */
export const renderActivityCard = (activity, dayIndex, activityIndex, time) => `
  <div class="activity p-2 border mb-3 draggable"
    data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
    <h4>${time} ${activity.name || ''}</h4>
    ${renderActivityFields(activity, dayIndex, activityIndex)}
    <button class="btn btn-danger delete-activity-button mt-2"
      data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
      Delete Activity
    </button>
  </div>`;

/**
 * Converts date index to full formatted string.
 * @param {string} startDate
 * @param {number} index
 * @returns {string}
 */
export const calculateDate = (startDate, index) =>
    moment(startDate, 'YYYY-MM-DD')
        .add(index, 'days')
        .format('dddd, MMMM Do YYYY');

/**
 * Renders full HTML for a single day entry.
 * @param {Day} day
 * @param {number} dayIndex
 * @param {string} tripName
 * @param {string} displayDate
 * @param {string} apiKey
 * @returns {string}
 */
export const renderDay = (day, dayIndex, tripName, displayDate, apiKey = '') => {
    const time = i => calculateActivityTime(day, i);

    return `
    <div class="day-wrapper print-only" data-day-index="${dayIndex}">
      <div class="day-entry print-only" data-day-index="${dayIndex}">
        ${dayIndex === 0 ? `<div class="trip-header">${tripName || 'Trip'}</div>` : ''}
        <div class="date-line">${displayDate}</div>
        <h1 class="location">${day.location || ''}</h1>
        <div class="hotel-details">
          ${day.lodging?.name || ''}<br>
          ${day.lodging?.address || ''}<br>
          ${day.lodging?.phone ? `Phone: ${day.lodging.phone}<br>` : ''}
          ${day.lodging?.roomType ? `Room: ${day.lodging.roomType}` : ''}
        </div>
        <hr class="separator">
        <div class="activities">
          ${day.activities.map((a, i) => `
            <div class="activity-block">
              <h1 class="activity-title">${time(i)} ${a.name || ''}</h1>
              ${a.location ? `<p class="activity-location">📍 ${a.location}</p>` : ''}
              ${a.notes ? `<p class="activity-notes"><strong>Notes:</strong> ${a.notes}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="day-wrapper no-print" data-day-index="${dayIndex}">
      <div class="day-entry card mb-3 p-3" data-day-index="${dayIndex}">
        <h3>${displayDate}</h3>
        ${renderDayFields(day, dayIndex)}
        ${day.suggestions ? formatSuggestionSection(day.suggestions, day.location, apiKey) : ''}
        <div id="activity-list-${dayIndex}" class="activity-list" data-day-index="${dayIndex}">
          ${day.activities.map((a, i) => renderActivityCard(a, dayIndex, i, time(i))).join('')}
        </div>
        <button class="btn btn-primary mt-3 add-activity-button" data-day-index="${dayIndex}">Add Activity</button>
        <button class="btn btn-danger delete-day-button" data-day-index="${dayIndex}">Delete Day</button>
      </div>
    </div>`;
};

/**
 * Renders the full trip into HTML.
 * @param {TripData} tripData
 * @param {string} apiKey
 * @returns {string}
 */
export const renderTripHTML = (tripData, apiKey = '') =>
    tripData.trip
        .map((day, index) =>
            renderDay(day, index, tripData.tripName, calculateDate(tripData.startDate, index), apiKey)
        )
        .join('');
