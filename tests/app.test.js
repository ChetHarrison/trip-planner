/**
 * @jest-environment jsdom
 */

const $ = require('jquery'); // Import jQuery
const TripPlanner = require('../public/js/app'); // Adjust this path to your actual app.js location

// Mock $.ajax globally for the tests
jest.mock('jquery', () => ({
  ajax: jest.fn((options) => {
    if (options.success) {
      // Mocked response from AJAX
      options.success([{ tripName: 'Test Trip', startDate: '2024-01-01', trip: [] }]);
    }
  })
}));

describe('TripPlanner', () => {

    let tripData;
    let dayNumber;

    beforeEach(() => {
        global.alert = jest.fn(); // Mock alert for tests

        // Initialize DOM mockup before each test
        document.body.innerHTML = `
            <div id="days-container">
                <div class="day-card" id="day-1">
                    <h3>Day 1</h3>
                    <input type="time" id="wake-up-time-1" value="08:00">
                    <div id="activity-list-1" class="activity-list"></div>
                </div>
            </div>
            <input type="text" id="trip-name" value="Test Trip">
            <input type="date" id="start-date" value="2024-01-01">
        `;

        // Set up test trip data with one day and one activity
        tripData = [
            {
                dayNumber: 1,
                wakeUpTime: '08:00',
                lodging: {
                    name: 'Test Lodging',
                    address: '123 Test St',
                    phone: '123-456-7890'
                },
                activities: []
                //     {
                //         id: 'activity-1-day-1',
                //         startTime: '8:00 AM',
                //         name: 'Test Activity',
                //         length: 30,
                //         location: 'Test Location',
                //         company: 'Test Company',
                //         notes: 'Test Notes'
                //     }
                // ]
            }
        ];

        dayNumber = 1;
        activityId = 'activity-1-day-1';

        // Mock console.log in tests that require it
        console.log = jest.fn();
    });


    test('should generate correct activity card HTML', () => {
        const activityId = 'activity-1-day-1';
        const html = TripPlanner.generateActivityCard(dayNumber, activityId);

        expect(html).toContain(`id="${activityId}"`);
        expect(html).toContain(`activity-name-${activityId}`);
        expect(html).toContain(`activity-location-${activityId}`);
    });

    test('should append activity card to the DOM on addActivity', () => {
        const initialLength = tripData[0].activities.length;

        // Call addActivity
        TripPlanner.addActivity(tripData, dayNumber);
        const updatedLength = tripData[0].activities.length;

        // Verify activity card is appended to the DOM
        expect(updatedLength).toBe(initialLength + 1);
        expect(document.querySelector(`#activity-list-${dayNumber} .draggable`)).not.toBeNull();
    });

    test('should initialize autocomplete on location and company inputs', () => {
        // Spy on initAutocomplete before addActivity is called
        const initAutocompleteSpy = jest.spyOn(TripPlanner, 'initAutocomplete');

        // Call the function to add the activity and generate the HTML
        TripPlanner.addActivity(tripData, dayNumber);

        // Dynamically grab the generated location and company inputs
        const activityId = `activity-${tripData[0].activities.length}-day-${dayNumber}`;
        const locationInput = document.getElementById(`activity-location-${activityId}`);
        const companyInput = document.getElementById(`activity-company-${activityId}`);

        // Log the inputs to verify they exist and have correct IDs
        console.log(locationInput.id);  // Should log correct ID like 'activity-location-activity-2-day-1'
        console.log(companyInput.id);   // Should log correct ID like 'activity-company-activity-2-day-1'

        // Check that initAutocomplete was called with the correct elements
        expect(initAutocompleteSpy).toHaveBeenCalledWith(locationInput, dayNumber, 'activity');
        expect(initAutocompleteSpy).toHaveBeenCalledWith(companyInput, dayNumber, 'company');
    });

    test('should collect trip data correctly from the DOM', () => {
        const tripJSON = TripPlanner.collectTripData();

        expect(tripJSON.tripName).toBe('Test Trip');
        expect(tripJSON.startDate).toBe('2024-01-01');
        expect(tripJSON.trip.length).toBeGreaterThan(0);
    });

    test('should log activity IDs correctly', () => {
        tripData[0].activities = [];  // Clear activities at the start of the test
        const expectedActivityId = `activity-1-day-${dayNumber}`;

        console.log = jest.fn();

        TripPlanner.addActivity(tripData, dayNumber);
        TripPlanner.logActivityIds(dayNumber);

        expect(console.log).toHaveBeenCalledWith(`Activity IDs for Day ${dayNumber}:`, expect.stringContaining(expectedActivityId));
    });

    test('should reorder activities correctly', () => {
        TripPlanner.addActivity(tripData, dayNumber);

        const updatedTripData = TripPlanner.reorderActivitiesAndRecalculate(dayNumber, tripData);
        console.log('Updated trip data:', updatedTripData);

        const firstActivityId = `activity-1-day-${dayNumber}`;
        expect(updatedTripData[0].activities[0].id).toBe(firstActivityId);
        expect(updatedTripData[0].activities.length).toBeGreaterThan(0);
    });

    test('should update the activity header correctly', () => {
        const activityId = `activity-1-day-${dayNumber}`;
        tripData[0].activities = [{ id: activityId, name: "New Activity Name", startTime: "8:00 AM" }];

        // Add the activity first
        TripPlanner.addActivity(tripData, dayNumber);
        
        // Now update the activity header
        const activityNameInput = document.getElementById(`activity-name-${activityId}`);
        if (activityNameInput) {
            activityNameInput.value = "New Activity Name";
            TripPlanner.updateActivityHeader(dayNumber, activityId, tripData);
        }
        
        const header = document.getElementById(`activity-header-${activityId}`).textContent;
        expect(header).toContain("New Activity Name");
    });

    test('should delete an activity correctly', () => {
        const activityId = `activity-1-day-${dayNumber}`;
        tripData[0].activities = [{ id: activityId, name: "Test Activity" }];
        
        // Add and delete the activity
        TripPlanner.addActivity(tripData, dayNumber);
        TripPlanner.deleteActivity(dayNumber, activityId, tripData);

        // Verify that activity is deleted from tripData and DOM
        const activityElement = document.getElementById(activityId);
        expect(activityElement).toBeNull();
        expect(tripData[0].activities.length).toBe(0);
    });

    test('should display element error correctly', () => {
        const element = document.createElement('div');
        element.id = 'test-element';
        document.body.appendChild(element);

        TripPlanner.displayElementError(element, "Test error message");

        expect(element.classList).toContain('error');
        expect(element.title).toBe("Test error message");
    });

    test('should log activity IDs correctly', () => {
    tripData[0].activities = []; // Clear activities to test addition from scratch
        const expectedActivityId = `activity-1-day-${dayNumber}`;

        console.log = jest.fn(); // Mock console.log for test verification

        TripPlanner.addActivity(tripData, dayNumber);
        TripPlanner.logActivityIds(dayNumber, tripData); // Pass tripData explicitly

        expect(console.log).toHaveBeenCalledWith(
            `Activity IDs for Day ${dayNumber}:`, expect.stringContaining(expectedActivityId)
        );
    });

});