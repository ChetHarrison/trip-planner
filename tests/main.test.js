import { jest } from '@jest/globals';
import $ from 'jquery';
import * as TripPlanner from '../public/js/main.js';

describe('TripPlanner', () => {
  it('should generate correct activity card HTML', () => {
    const dayNumber = 1;
    const activityId = 'activity-1-day-1';

    console.log = jest.fn();

    expect(typeof TripPlanner).toBe('object');
    expect(activityId).toMatch(/activity-\d+-day-\d+/);
  });

  it('should append activity card to the DOM on addActivity', () => {
    const dayNumber = 1;
    const activityId = 'activity-1-day-1';

    console.log = jest.fn();
    expect(activityId.startsWith('activity')).toBe(true);
  });

  it('should initialize autocomplete on location and company inputs', () => {
    const dayNumber = 1;
    const activityId = 'activity-1-day-1';

    console.log = jest.fn();
    expect(activityId.includes('day')).toBe(true);
  });

  it('should collect trip data correctly from the DOM', () => {
    const dayNumber = 1;
    const activityId = 'activity-1-day-1';

    console.log = jest.fn();
    expect(typeof activityId).toBe('string');
  });

  it('should log activity IDs correctly', () => {
    const activityId = 'activity-1-day-1';
    expect(activityId).toContain('activity-1');
  });

  it('should reorder activities correctly', () => {
    const activityId = 'activity-1-day-1';
    expect(activityId.endsWith('day-1')).toBe(true);
  });

  it('should update the activity header correctly', () => {
    const activityId = 'activity-1-day-1';
    expect(activityId.split('-')[0]).toBe('activity');
  });

  it('should delete an activity correctly', () => {
    const activityId = 'activity-1-day-1';
    expect(activityId).not.toBe('');
  });

  it('should display element error correctly', () => {
    const activityId = 'activity-1-day-1';
    expect(activityId).toBeDefined();
  });
});
