/**
 * @file tripPure.js
 * @description Pure rendering utilities for the trip planner UI.
 * Includes form generators and full day layout generation.
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
  { label: 'Location', type: 'text', key: 'location', placeholder: 'Enter location' },
  { label: 'Hotel Name', type: 'text', key: 'lodging.name', placeholder: 'Hotel name' },
  { label: 'Address', type: 'text', key: 'lodging.address', placeholder: 'Hotel address' },
  { label: 'Phone', type: 'text', key: 'lodging.phone', placeholder: 'Hotel phone' },
  { label: 'Room Type', type: 'text', key: 'lodging.roomType', placeholder: 'Room type' },
];

const activityFieldConfigs = [
  { label: 'Name', type: 'text', key: 'name' },
  { label: 'Length (min)', type: 'number', key: 'length', className: 'activity-length' },
  { label: 'Location', type: 'text', key: 'location', placeholder: 'Activity location' },
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
        <div id="activity-list-${dayIndex}" class="activity-list" data-day-index="${dayIndex}">
          ${day.activities.map((a, i) => renderActivityCard(a, dayIndex, i, time(i))).join('')}
        </div>
        <button class="btn btn-primary mt-3 add-activity-button" data-day-index="${dayIndex}">Add Activity</button>
        <button class="btn btn-danger delete-day-button" data-day-index="${dayIndex}">Delete Day</button>
      </div>
    </div>`;
};

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
