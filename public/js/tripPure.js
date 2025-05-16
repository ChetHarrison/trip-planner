/**
 * @file tripPure.js
 * @description Pure rendering utilities for the trip planner UI.
 * Includes form generators, suggestion rendering, and full day layout generation.
 * Declarative, point-free, and fully testable.
 */

import moment from 'moment';

export const getNested = (obj, path) =>
path.split('.').reduce((acc, key) => acc?.[key], obj);

export const dataAttrs = (attrs = {}) =>
Object.entries(attrs)
.map(([k, v]) => `data-${k}="${v}"`)
.join(' ');

export const formRowLabeled = (label, id) => (html) => `
  <div class="row mb-2">
    <label class="col-2 col-form-label" for="${id}">${label}</label>
    <div class="col-10">${html}</div>
	</div>`;

export const inputField = (
	type,
	{ className = '', value = '', placeholder = '', dataAttrs: dataAttrsObj = {} } = {}
	) => {
	const attrs = dataAttrs(dataAttrsObj);
	if (type === 'textarea') {
		return `<textarea class="form-control ${className}" rows="2" ${attrs}>${value}</textarea>`;
	}
	return `<input type="${type}" class="form-control ${className}" value="${value}" placeholder="${placeholder}" ${attrs}>`;
};

export const renderFormField = (
	label,
	type,
	value,
	className = '',
	placeholder = '',
	dataAttrs = {}
	) => {
	const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
	const input = inputField(type, {
		className,
		value,
		placeholder,
		dataAttrs: { ...dataAttrs, id, name: id }
	});
	return formRowLabeled(label, id)(input);
};

/**
 * Calculates the display date string for a day in the trip.
 * @param {string} startDate - The trip start date in YYYY-MM-DD format
 * @param {number} index - Index of the day relative to start date
 * @returns {string} Formatted date string, e.g., "Monday, July 1st 2025"
 */
export const calculateDate = (startDate, index) => {
    return moment(startDate, 'YYYY-MM-DD')
        .add(index, 'days')
        .format('dddd, MMMM Do YYYY');
};

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

const dayFieldConfigs = [
	{ label: 'Start Time', type: 'text', key: 'wakeUpTime', className: 'wake-up-time', placeholder: '08:00' },
	{ label: 'Location', type: 'text', key: 'location', className: 'day-location classic-location-autocomplete', placeholder: 'Search location...' },
	{ label: 'Hotel Name', type: 'text', key: 'lodging.name', className: 'hotel-name classic-hotel-autocomplete', placeholder: 'Search hotel...' },
	{ label: 'Address', type: 'text', key: 'lodging.address', placeholder: 'Hotel address' },
	{ label: 'Phone', type: 'text', key: 'lodging.phone', placeholder: 'Hotel phone' },
	{ label: 'Room Type', type: 'text', key: 'lodging.roomType', placeholder: 'Room type' },
];

const activityFieldConfigs = [
	{ label: 'Name', type: 'text', key: 'name' },
	{ label: 'Length (min)', type: 'number', key: 'length', className: 'activity-length' },
	{ label: 'Location', type: 'text', key: 'location', className: 'activity-location classic-activity-autocomplete', placeholder: 'Search location...' },
	{ label: 'Notes', type: 'textarea', key: 'notes' }
];

export const renderDayFields = (day, dayIndex) =>
dayFieldConfigs.map(({ label, type, key, className = '', placeholder = '' }) =>
	renderFormField(label, type, getNested(day, key) || '', className, placeholder, {
		'day-index': dayIndex,
		field: key
	})
	).join('');

export const renderActivityFields = (activity, dayIndex, activityIndex) =>
activityFieldConfigs.map(({ label, type, key, className = '', placeholder = '' }) =>
	renderFormField(label, type, activity[key] || '', className, placeholder, {
		'day-index': dayIndex,
		'activity-index': activityIndex,
		field: key
	})
	).join('');

/**
 * Renders a single activity card in the editable day view.
 * @param {Activity} activity - Activity object containing name, location, notes, etc.
 * @param {number} dayIndex - Index of the day in the trip
 * @param {number} activityIndex - Index of the activity within the day
 * @param {string} time - Computed start time string (e.g., "10:30 AM")
 * @returns {string} HTML string representing the activity card
 */
export const renderActivityCard = (activity, dayIndex, activityIndex, time) => {
    return `
        <div class="activity p-2 border mb-3 draggable"
            data-day-index="${dayIndex}"
            data-activity-index="${activityIndex}">
            <h4>${time} ${activity.name || ''}</h4>
            ${renderActivityFields(activity, dayIndex, activityIndex)}
            <button class="btn btn-danger delete-activity-button mt-2"
                data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                Delete Activity
            </button>
        </div>`;
};

/**
 * Renders a single day card with print and screen views.
 * @param {Day} day - The day data
 * @param {number} dayIndex - Index of the day in the trip
 * @param {string} tripName - Trip name for header (only shown on first day)
 * @param {string} displayDate - Formatted date string (e.g., "Monday, July 1st")
 * @param {string} apiKey - Google Maps API key
 * @returns {string} HTML string for the full day section
 */
export const renderDay = (day, dayIndex, tripName, displayDate, apiKey = '') => {
    const time = (i) => calculateActivityTime(day, i);
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
 * Formats the suggestions section for a day, including top restaurants, sights, and history.
 * Renders embedded maps for each restaurant or sight that includes a place_id.
 *
 * @param {{
 *   restaurants: Array<{ name: string, formatted_address: string, place_id?: string }>,
 *   sights: Array<{ name: string, formatted_address: string, place_id?: string }>,
 *   history: string
 * }} suggestions - Suggestion data returned from the server
 * @param {string} location - The city or region name (used in history section)
 * @param {string} apiKey - Google Maps Embed API key
 * @returns {string} HTML string for suggestion cards
 */
export const formatSuggestionSection = (suggestions, location, apiKey) => {
    const formatCardsRow = (label, list) =>
        list?.length
            ? `<h5 class="mt-3">${label}</h5>
               <div class="d-flex flex-wrap gap-2 mb-3">
                 ${list.slice(0, 5).map(p => `
                   <div style="flex: 1 1 calc(20% - 10px); min-width: 200px;">
                     <strong>${p.name}</strong><br>
                     ${p.formatted_address || ''}<br>
                     ${p.place_id && apiKey
                        ? `<iframe width="100%" height="200" frameborder="0" style="margin-top:5px"
                             src="https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${p.place_id}"
                             allowfullscreen></iframe>`
                        : ''}
                   </div>`).join('')}
               </div>`
            : '';

    return `
        <div class="day-info-section">
            ${formatCardsRow('Top 5 Restaurants Nearby', suggestions?.restaurants || [])}
            ${formatCardsRow('Top 5 Tourist Sights', suggestions?.sights || [])}
            ${suggestions?.history
                ? `<div class="mt-4"><h5>History of ${location}</h5><p>${suggestions.history}</p></div>`
                : ''}
        </div>`;
};

/**
 * Renders the full trip into an HTML string.
 *
 * Iterates through each day in the trip and calls `renderDay` to produce both
 * the screen and print-friendly markup for the day, including lodging, activities,
 * suggestions (restaurants, sights, and history), and controls.
 *
 * @param {TripData} tripData - The entire trip structure with metadata and days.
 * @param {string} [apiKey=''] - Google Maps API key used for embedded maps.
 * @returns {string} HTML string representing the full trip layout.
 */
export const renderTripHTML = (tripData, apiKey = '') => {
  if (!tripData || !Array.isArray(tripData.trip)) return '';
  return tripData.trip
    .map((day, index) =>
      renderDay(
        day,
        index,
        tripData.tripName,
        calculateDate(tripData.startDate, index),
        apiKey
      )
    )
    .join('');
};
