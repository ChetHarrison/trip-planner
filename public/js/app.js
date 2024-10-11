const TripPlanner = (function () {

    function addActivity(tripData, dayIndex) {
        if (!tripData || !Array.isArray(tripData)) {
            console.error("tripData is not a valid array:", tripData);
            return null;
        }

        const updatedTripData = [...tripData];
        const dayData = { ...updatedTripData[dayIndex] };

        if (!dayData.activities) {
            dayData.activities = [];
        }

        const newActivity = { name: "", length: 0, location: "", company: "", notes: "" };
        dayData.activities = [...dayData.activities, newActivity];
        updatedTripData[dayIndex] = dayData;

        return updatedTripData;
    }

    function addDay(tripData, startDate) {
        const newDay = {
            wakeUpTime: "08:00",
            lodging: { name: "", address: "", phone: "" },
            activities: []
        };

        // Create a copy of tripData and add the new day
        return [...tripData, newDay];
    }

    function collectTripData() {
        const tripName = $('#trip-name').val();
        const startDate = $('#start-date').val();

        if (!tripName || !startDate) {
            console.error('Trip name or start date is missing');
            alert('Please enter a trip name and start date before saving.');
            return null; // Stop if data is invalid
        }

        const tripData = [];

        // Collect data for each day
        $('.day-card').each(function (index) {
            const dayNumber = index + 1;
            const wakeUpTime = $(`#wake-up-time-${dayNumber}`).val();

            // Collect lodging information
            const lodging = {
                name: $(`#lodging-name-${dayNumber}`).val(),
                address: $(`#lodging-address-${dayNumber}`).val(),
                phone: $(`#lodging-phone-${dayNumber}`).val()
            };

            const activities = [];

            // Collect activities for the day
            $(`#activity-list-${dayNumber} .draggable`).each(function () {
                const activityId = $(this).attr('id');
                activities.push({
                    name: $(`#activity-name-${activityId}`).val(),
                    length: $(`#activity-length-${activityId}`).val(),
                    location: $(`#activity-location-${activityId}`).val(),
                    company: $(`#activity-company-${activityId}`).val(),
                    notes: $(`#activity-notes-${activityId}`).val()
                });
            });

            // Add day data to tripData
            tripData.push({ wakeUpTime, lodging, activities });
        });

        // Return trip state object with name, date, and trip data
        const tripState = { tripName, startDate, trip: tripData };
        console.log("Trip data to save:", tripData);
        return tripState;
    }

    function deleteActivity(dayIndex, activityIndex) {
        console.log(`Deleting activity ${activityIndex} from day ${dayIndex}`);

        // Get the latest trip data
        const tripData = TripPlanner.collectTripData();

        // Check if tripData, tripData.trip, and tripData.trip[dayIndex] are properly defined
        if (!tripData || !Array.isArray(tripData.trip) || !tripData.trip[dayIndex] || !Array.isArray(tripData.trip[dayIndex].activities)) {
            console.error("Invalid trip data structure. Unable to delete activity.");
            return;
        }

        // Remove the specified activity from the trip data
        tripData.trip[dayIndex].activities.splice(activityIndex, 1);

        // Clear the existing DOM for the day's activity list
        const activityListElement = document.getElementById(`activity-list-${dayIndex + 1}`);
        activityListElement.innerHTML = '';

        // Re-render each activity with updated IDs and recalculate start times
        const startTimes = TripPlanner.deriveStartTimes(tripData.trip[dayIndex]);
        tripData.trip[dayIndex].activities.forEach((activity, newIndex) => {
            const newActivityId = `activity-${newIndex + 1}-day-${dayIndex + 1}`;
            const activityHTML = TripPlanner.generateActivityHTML(dayIndex, newIndex, {
                ...activity,
                startTime: startTimes[newIndex]
            });
            TripPlanner.appendActivityToDOM(dayIndex, newIndex, activityHTML);

            // Update the activity name in the tripData with the new start time and ID
            const headerElement = document.getElementById(`activity-header-${newActivityId}`);
            if (headerElement) {
                headerElement.textContent = `${startTimes[newIndex]} - ${activity.name || ""}`;
            }
        });

        // Save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    function deleteDay(dayIndex) {
        // Get the latest trip data
        const tripData = TripPlanner.collectTripData();

        // Ensure tripData.trip is an array before using .filter()
        if (!Array.isArray(tripData.trip)) {
            console.error("Invalid trip data structure. Unable to delete day.");
            return tripData;
        }

        // Filter out the specified day at dayIndex
        tripData.trip = tripData.trip.filter((_, index) => index !== dayIndex);

        return tripData;
    }

    function deriveStartTimes(dayData) {
    if (!dayData || !Array.isArray(dayData.activities)) {
        console.error("dayData or dayData.activities is undefined or not an array");
        return [];
    }

    let currentTime = moment(dayData.wakeUpTime, "HH:mm");

    // Return an array of start times for each activity in the day
    return dayData.activities.map((activity) => {
        const startTime = currentTime.format("h:mm A");
        currentTime.add(parseInt(activity.length, 10) || 0, 'minutes');
        return startTime;
    });
}

    function deriveStartTimes(dayData) {
        if (!dayData || !Array.isArray(dayData.activities)) {
            console.error("dayData or dayData.activities is undefined or not an array");
            return [];
        }

        let currentTime = moment(dayData.wakeUpTime, "HH:mm");
        return dayData.activities.map((activity) => {
            const startTime = currentTime.format("h:mm A");
            currentTime.add(parseInt(activity.length, 10) || 0, 'minutes');
            return startTime;
        });
    }

    function generateActivityCard(dayIndex, activityId, activity, startTime) {
        return `
            <div class="activity">
                <div class="activity-header">
                    <span class="activity-time">${startTime}</span> -
                    <span class="activity-title">${activity.name || ""}</span>
                </div>
                <div class="edit-mode">
                    <label for="activity-location-${activityId}">Location:</label>
                    <input type="text" class="form-control mb-2 activity-location"
                        id="activity-location-${activityId}"
                        placeholder="Location"
                        value="${activity.location || ''}">
                </div>
                <div class="print-only">${activity.location || ''}</div>

                <div class="edit-mode">
                    <label for="activity-notes-${activityId}">Notes:</label>
                    <textarea class="form-control mb-2 activity-notes"
                        id="activity-notes-${activityId}"
                        placeholder="Notes">${activity.notes || ''}</textarea>
                </div>
                <div class="print-only">${activity.notes || ''}</div>
            </div>
        `;
    }

    function generateActivityHTML(dayIndex, activityIndex, activity, startTime = "N/A") {
        const activityId = TripPlanner.generateActivityId(dayIndex, activityIndex);
        return TripPlanner.generateActivityCard(dayIndex, activityId, activity, startTime);
    }

    function generateActivityId(dayIndex, activityIndex) {
        return `activity-${activityIndex + 1}-day-${dayIndex + 1}`;
    }

    function generateDayCard(dayNumber, displayDate, dayData = {}) {
        const isoDate = dayData.isoDate || new Date().toISOString().split('T')[0];

        return `
            <div class="day-entry" id="day-${dayNumber}">
                <h3 class="day-title">${displayDate}</h3>

                <div class="lodging-info">
                    <h5>Lodging</h5>

                    <div class="edit-mode">
                        <label for="lodging-name-${dayNumber}">Name:</label>
                        <input type="text" id="lodging-name-${dayNumber}" class="form-control"
                               value="${dayData.lodging?.name || ''}">
                    </div>
                    <div class="print-only">${dayData.lodging?.name || ''}</div>

                    <div class="edit-mode">
                        <label for="lodging-address-${dayNumber}">Address:</label>
                        <input type="text" id="lodging-address-${dayNumber}" class="form-control"
                               value="${dayData.lodging?.address || ''}">
                    </div>
                    <div class="print-only">${dayData.lodging?.address || ''}</div>

                    <div class="edit-mode">
                        <label for="lodging-phone-${dayNumber}">Phone:</label>
                        <input type="text" id="lodging-phone-${dayNumber}" class="form-control"
                               value="${dayData.lodging?.phone || ''}">
                    </div>
                    <div class="print-only">${dayData.lodging?.phone || ''}</div>
                </div>

                <!-- Dining Suggestions -->
                <div id="dining-suggestions-${dayNumber}" class="dining-suggestions">
                    <h5>Restaurant Suggestions</h5>
                    <p>Enter a lodging address to see nearby restaurants.</p>
                </div>

                <!-- Location History -->
                <div id="location-history-${dayNumber}" class="location-history">
                    <h5>Location History</h5>
                    <p>Enter a lodging address to see historical information.</p>
                </div>

                <!-- Activity List -->
                <div id="activity-list-${dayNumber}" class="activity-list"></div>

                <!-- Add Activity Button -->
                <button class="btn btn-primary add-activity-button"
                    onclick="TripPlanner.handleAddActivity(${dayNumber - 1})">
                    Add Activity
                </button>
            </div>
        `;
    }

    function generateDayId(dayIndex) {
        return `day-${dayIndex + 1}`;
    }

    function generateTripHeader(tripName, startDate) {
        const tripYear = new Date(startDate).getFullYear();
        return `
            <h1 id="trip-title">${tripName}, ${tripYear}</h1>
        `;
    }

    function recalculateStartTimes(dayData) {
        console.log(dayData);
        console.log(dayData.activities);
        // Check if dayData and dayData.activities are defined and is an array
        if (!dayData || !Array.isArray(dayData.activities)) {
            console.error("dayData or dayData.activities is undefined or not an array");
            return []; // Return an empty array if dayData or activities is missing
        }

        let currentTime = moment(dayData.wakeUpTime, "HH:mm");

        // Calculate start times for each activity (will return [] if activities is empty)
        return dayData.activities.map((activity) => {
            const startTime = currentTime.format("h:mm A");
            currentTime.add(parseInt(activity.length, 10) || 0, 'minutes');
            return { ...activity, calculatedStartTime: startTime };
        });
    }

    // IMPURE FUNCTIONS

    function appendActivityToDOM(dayIndex, activityIndex, activityHTML) {
        const activityListElement = document.getElementById(`activity-list-${dayIndex + 1}`);
        if (activityListElement) {
            activityListElement.insertAdjacentHTML("beforeend", activityHTML);

            // Initialize autocomplete for location and company fields
            const activityId = TripPlanner.generateActivityId(dayIndex, activityIndex);
            TripPlanner.initAutocomplete(document.getElementById(`activity-location-${activityId}`), dayIndex, 'activity');
        }
    }

    function autoSaveTrip() {
        const tripData = collectTripData();
        saveTrip(tripData);
    }

    function handleAddActivity(dayIndex) {
        const currentTripData = TripPlanner.collectTripData();

        // Add the new activity to the specified day
        const updatedTripData = TripPlanner.addActivity(currentTripData.trip, dayIndex);
        const newActivity = updatedTripData[dayIndex].activities[updatedTripData[dayIndex].activities.length - 1];

        // Update the trip data with the new flight fields
        updatedTripData[dayIndex].activities[updatedTripData[dayIndex].activities.length - 1] = newActivity;

        // Generate the HTML for the new activity and render it in the DOM
        const activityHTML = TripPlanner.generateActivityHTML(dayIndex, updatedTripData[dayIndex].activities.length - 1, newActivity);
        TripPlanner.appendActivityToDOM(dayIndex, updatedTripData[dayIndex].activities.length - 1, activityHTML);

        // Recalculate start times after adding the new activity
        const startTimes = TripPlanner.deriveStartTimes(updatedTripData[dayIndex]);

        // Update the DOM headers with the new start times
        startTimes.forEach((startTime, activityIndex) => {
            const activityId = TripPlanner.generateActivityId(dayIndex, activityIndex);
            const headerElement = document.getElementById(`activity-header-${activityId}`);
            if (headerElement) {
                const activity = updatedTripData[dayIndex].activities[activityIndex];
                headerElement.textContent = `${startTime} - ${activity.name || ""}`;
            }
        });

        // Automatically save the updated trip data
        TripPlanner.autoSaveTrip();
    }


    function handleActivityLengthChange(dayIndex) {
        const tripData = TripPlanner.collectTripData();

        // Recalculate start times for all activities on the specified day
        const updatedActivities = TripPlanner.recalculateStartTimes(tripData.trip[dayIndex]);

        // Update the activities in tripData
        tripData.trip[dayIndex].activities = updatedActivities;

        // Update the DOM to reflect the new start times
        updatedActivities.forEach((activity, activityIndex) => {
            const activityId = TripPlanner.generateActivityId(dayIndex, activityIndex);
            const headerElement = document.getElementById(`activity-header-${activityId}`);
            if (headerElement) {
                headerElement.textContent = `${activity.calculatedStartTime} - ${activity.name || ""}`;
            }
        });

        // Save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    function fetchDayLocationData(city, dayNumber) {
        console.log(`Fetching data for city: ${city}`);

        // Fetch Dining Suggestions
        $.ajax({
            url: `/getDiningSuggestions?location=${encodeURIComponent(city)}`,
            method: 'GET',
            success: function (data) {
                const suggestions = data.results || [];
                let suggestionsHTML = "<h5>Restaurant Suggestions</h5><ul>";
                suggestions.forEach(restaurant => {
                    suggestionsHTML += `<li>${restaurant.name} - ${restaurant.formatted_address}</li>`;
                });
                suggestionsHTML += "</ul>";
                $(`#dining-suggestions-${dayNumber}`).html(suggestionsHTML);
            },
            error: function (error) {
                console.error('Error fetching dining suggestions:', error);
                $(`#dining-suggestions-${dayNumber}`).html('<h5>Restaurant Suggestions</h5><p>Error fetching dining suggestions.</p>');
            }
        });

        // Fetch Location History
        $.ajax({
            url: `/getLocationHistory?location=${encodeURIComponent(city)}`,
            method: 'GET',
            success: function (data) {
                const historyHTML = `<h5>Location History</h5><p>${data.extract || 'No historical information available.'}</p>`;
                $(`#location-history-${dayNumber}`).html(historyHTML);
            },
            error: function (error) {
                console.error('Error fetching location history:', error);
                $(`#location-history-${dayNumber}`).html('<h5>Location History</h5><p>Error fetching historical information.</p>');
            }
        });
    }

    function handleDeleteDay(dayIndex) {
        // Get updated trip data after deleting the specified day
        const updatedTripData = TripPlanner.deleteDay(dayIndex);

        // Re-render the trip with the updated trip data
        renderTrip(updatedTripData);

        // Save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    function initAutocomplete(input, dayNumber) {
        const autocomplete = new google.maps.places.Autocomplete(input, { types: ['geocode'] });

        autocomplete.addListener('place_changed', function () {
            const place = autocomplete.getPlace();
            const formattedAddress = place.formatted_address || '';

            // Update activity location
            $(`#activity-location-${dayNumber}`).val(formattedAddress);

            // Automatically save trip data
            TripPlanner.autoSaveTrip();
        });
    }

    function initDragAndDrop(dayIndex) {
        const container = document.getElementById(`activity-list-${dayIndex + 1}`);
        const drake = dragula([container]);

        drake.on('drop', function(el, target, source, sibling) {
            // After drop, reorder activities and update start times
            TripPlanner.handleActivityReorder(dayIndex);

            TripPlanner.autoSaveTrip();
        });
    };

    function handleActivityReorder(dayIndex) {
        const tripData = TripPlanner.collectTripData();

        // Get the DOM elements in the new order and update IDs and activity names in `tripData`
        const activityElements = $(`#activity-list-${dayIndex + 1} .draggable`);
        activityElements.each((newIndex, el) => {
            // Generate the new sequential activity ID based on the new order
            const newActivityId = `activity-${newIndex + 1}-day-${dayIndex + 1}`;

            // Update the element's ID and header ID
            $(el).attr('id', newActivityId);
            $(el).find('.activity-header').attr('id', `activity-header-${newActivityId}`);

            // Update the IDs of all related input fields and labels
            $(el).find('[id]').each(function() {
                const oldId = $(this).attr('id');
                const newId = oldId.replace(/activity-\d+-day-\d+/, newActivityId);
                $(this).attr('id', newId);
                $(this).attr('for', newId); // Also update 'for' attributes for labels
            });

            // Update onclick handlers to pass the new ID
            $(el).find('button[onclick]').each(function() {
                const onclick = $(this).attr('onclick').replace(/activity-\d+-day-\d+/, newActivityId);
                $(this).attr('onclick', onclick);
            });

            // Update the activity name in `tripData` to match the new order and name in the DOM
            const activityName = $(`#activity-name-${newActivityId}`).val();
            tripData.trip[dayIndex].activities[newIndex].name = activityName;
        });

        // Recalculate start times based on the reordered activities
        const startTimes = TripPlanner.deriveStartTimes(tripData.trip[dayIndex]);

        // Update each activity header in the DOM with the new start times and activity names
        startTimes.forEach((startTime, activityIndex) => {
            const activityId = `activity-${activityIndex + 1}-day-${dayIndex + 1}`;
            const headerElement = document.getElementById(`activity-header-${activityId}`);
            if (headerElement) {
                const activityName = tripData.trip[dayIndex].activities[activityIndex].name;
                headerElement.textContent = `${startTime} - ${activityName || ""}`;
            }
        });

        // Automatically save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    async function loadSavedTrip(tripDataFromFile) {

        // Set trip name and start date in visible fields
        $('#trip-name').val(tripDataFromFile.tripName || '');
        $('#start-date').val(tripDataFromFile.startDate || '');

        // Display trip title
         $('#trip-title').remove(); // Remove the old title (will not fail if not trip-title exists)
        const tripHeaderHTML = TripPlanner.generateTripHeader(tripDataFromFile.tripName, tripDataFromFile.startDate);
        $('#trip-container').append(tripHeaderHTML);

        renderTrip(tripDataFromFile);
    }

    function loadSavedTrips() {
        $.ajax({
            url: '/getTrips',
            type: 'GET',
            success: function (data) {
                const tripSelector = $('#trip-selector');
                tripSelector.empty();
                tripSelector.append('<option value="">Select a trip</option>');
                tripSelector.append('<option value="new">New Trip</option>');
                data.forEach(trip => {
                    tripSelector.append(`<option value="${trip}">${trip.replace('.json', '')}</option>`);
                });
            },
            error: function (err) {
                console.error('Error fetching trips:', err);
            }
        });
    }

    function loadTripFromFile(tripName) {
        $.ajax({
            url: `/getTrip?tripName=${tripName}`,
            type: 'GET',
            success: function (tripDataFromFile) {
                TripPlanner.loadSavedTrip(tripDataFromFile);
            },
            error: function (err) {
                console.error('Error loading trip:', err);
            }
        });
    }

    function removeDayCardFromDOM(dayNumber) {
        const dayCard = document.getElementById(`day-${dayNumber}`);
        if (dayCard) {
            dayCard.remove();
        } else {
            console.error(`Day card for Day ${dayNumber} not found.`);
        }
    }

    function renderDay(dayIndex, startDate) {
        const dayNumber = dayIndex + 1;

        // Use a parsable date format (e.g., ISO 8601)
        const dayDate = moment(startDate).add(dayIndex, 'days').format('YYYY-MM-DD');
        const displayDate = moment(dayDate).format('dddd, MMMM Do, YYYY'); // For display purposes only

        // Pass both formatted date and display date to the day card generator
        const dayCardHTML = TripPlanner.generateDayCard(dayNumber, displayDate, { isoDate: dayDate });
        $('#days-container').append(dayCardHTML);

        // Initialize components as needed (e.g., autocomplete, drag-and-drop)
        TripPlanner.initLodgingAutocomplete(document.getElementById(`lodging-name-${dayNumber}`), dayNumber, 'lodging');
        TripPlanner.initDragAndDrop();

        // Automatically fetch suggestions for lodging address
        const address = $(`#lodging-address-${dayNumber}`).val();
        if (address && address.trim() !== '') {
            TripPlanner.handleLodgingAddressBlur(dayNumber);
        }
    }

    function renderTrip(tripData) {
        $('#days-container').empty();

        tripData.trip.forEach((day, dayIndex) => {
            const dayNumber = dayIndex + 1;
            const dayDate = moment(tripData.startDate).add(dayIndex, 'days').format('MMMM Do, YYYY');

            // Generate and insert day card HTML
            const dayCardHTML = TripPlanner.generateDayCard(dayNumber, dayDate);
            $('#days-container').append(dayCardHTML);

            $(`#lodging-name-${dayNumber}`).val(day.lodging.name || '');
            $(`#lodging-address-${dayNumber}`).val(day.lodging.address || '');
            $(`#lodging-phone-${dayNumber}`).val(day.lodging.phone || '');
            $(`#wake-up-time-${dayNumber}`).val(day.wakeUpTime || '');

            const startTimes = TripPlanner.deriveStartTimes(day);

            // Render each activity card with the derived start times
            day.activities.forEach((activity, activityIndex) => {
                const activityId = TripPlanner.generateActivityId(dayIndex, activityIndex);
                const activityCardHTML = TripPlanner.generateActivityCard(dayIndex, activityId, activity, startTimes[activityIndex]);
                $(`#activity-list-${dayNumber}`).append(activityCardHTML);
            });

            TripPlanner.initLodgingAutocomplete(document.getElementById(`lodging-name-${dayNumber}`), dayNumber, 'lodging');
            TripPlanner.initDragAndDrop(dayIndex);
        });
    }

    function saveTrip(tripData) {
        // if (!tripData.tripName || !tripData.startDate) {
        //     alert('Please enter a trip name and start date.');
        //     return;
        // }

        // Log for debugging
        console.log("Saving trip:", tripData);

        $.ajax({
            url: '/saveTrip', // Replace with the actual server endpoint
            method: 'POST',
            data: JSON.stringify(tripData),
            contentType: 'application/json',
            success: function(response) {
                console.log("Trip saved successfully:", response);
            },
            error: function(error) {
                console.error("Error saving trip:", error);
            }
        });
    }

    function updateActivityHeaders(dayIndex, calculatedActivities) {
        calculatedActivities.forEach((activity, index) => {
            const activityId = TripPlanner.generateActivityId(dayIndex, index);
            const headerElement = document.getElementById(`activity-header-${activityId}`);
            if (headerElement) {
                headerElement.textContent = `${activity.calculatedStartTime} - ${activity.name}`;
            }
        });
    }

    function updateActivityName(dayIndex, activityId) {
        const tripData = TripPlanner.collectTripData();
        const dayData = tripData.trip[dayIndex];
        const activityIndex = parseInt(activityId.split('-')[1]) - 1;

        const activityNameInput = document.getElementById(`activity-name-${activityId}`);
        const newName = activityNameInput ? activityNameInput.value : '';

        // Update the name in tripData
        dayData.activities[activityIndex].name = newName;

        // Update the header in the DOM
        const headerElement = document.getElementById(`activity-header-${activityId}`);
        if (headerElement) {
            const startTime = headerElement.textContent.split(' - ')[0];
            headerElement.textContent = `${startTime} - ${newName}`;
        }
    }

    // Function to dynamically create form elements
    function initializeTripForm() {
        const tripContainer = $('#trip-container');

        // Create and append form elements
        const selectTripLabel = createLabel('Select Trip:', 'trip-selector');
        const tripSelector = createSelect(['Select a trip', 'New Trip'], 'trip-selector');

        const tripNameLabel = createLabel('Trip Name:', 'trip-name');
        const tripNameInput = createInput('trip-name', 'text', 'Enter trip name');

        const startDateLabel = createLabel('Start Date:', 'start-date');
        const startDateInput = createInput('start-date', 'date');

        // Append elements to the trip container
        tripContainer.append(selectTripLabel, tripSelector, tripNameLabel, tripNameInput, startDateLabel, startDateInput);
    }

    // Helper functions
    function createLabel(text, forId) {
        const label = document.createElement('label');
        label.textContent = text;
        label.setAttribute('for', forId);
        label.classList.add('form-label');
        return label;
    }

    function createInput(id, type, placeholder = '') {
        const input = document.createElement('input');
        input.id = id;
        input.type = type;
        input.placeholder = placeholder;
        input.classList.add('form-control', 'mb-3');
        return input;
    }

    function createSelect(options, id) {
        const select = document.createElement('select');
        select.id = id;
        select.classList.add('form-select', 'mb-3');
        options.forEach(optionText => {
            const option = document.createElement('option');
            option.value = optionText.toLowerCase().replace(/\s+/g, '-');
            option.textContent = optionText;
            select.appendChild(option);
        });
        return select;
    }

    function extractCityFromGooglePlace(place) {
        if (!place || !place.address_components) {
            console.error('Invalid Google Place object:', place);
            return null;
        }

        let city = null;
        for (const component of place.address_components) {
            if (component.types.includes('locality')) {
                city = component.long_name; // City name
                break;
            } else if (component.types.includes('administrative_area_level_1') && !city) {
                city = component.long_name; // Fallback to state/province
            }
        }

        if (!city) {
            console.warn('City not found in address components:', place.address_components);
        }
        return city;
    }

    function initLodgingAutocomplete(input, dayNumber) {
        const autocomplete = new google.maps.places.Autocomplete(input, { types: ['establishment'] });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();

            if (!place || !place.address_components) {
                console.error('Invalid place data received from Google Places.');
                return;
            }

            // Extract city from Google Places
            const city = TripPlanner.extractCityFromGooglePlace(place);
            const fullAddress = place.formatted_address || '';

            console.log(`Extracted city: ${city}`);
            console.log(`Full address for dining suggestions: ${fullAddress}`);

            if (!city) {
                console.error('City not found in address components for lodging.');
                $(`#dining-suggestions-${dayNumber}`).html('<h5>Restaurant Suggestions</h5><p>City not found. Unable to fetch dining suggestions.</p>');
                $(`#location-history-${dayNumber}`).html('<h5>Location History</h5><p>City not found. Unable to fetch historical information.</p>');
                return;
            }

            // Fetch Dining Suggestions using the full address
            TripPlanner.fetchDiningSuggestions(fullAddress, dayNumber);

            // Fetch Location History using the city
            TripPlanner.fetchLocationHistory(city, dayNumber);

            // Update lodging-specific fields
            $(`#lodging-address-${dayNumber}`).val(fullAddress);
            $(`#lodging-phone-${dayNumber}`).val(place.formatted_phone_number || '');
            $(`#lodging-name-${dayNumber}`).val(place.name || '');

            // Automatically save trip data
            TripPlanner.autoSaveTrip();
        });
    }

    function fetchDiningSuggestions(address, dayNumber) {
        console.log(`Fetching dining suggestions for address: ${address}`);


        $.ajax({
            url: `/getDiningSuggestions?location=${encodeURIComponent(address)}`,
            method: 'GET',
            success: function (data) {
                console.log('Dining Suggestions Data:', data);
                const suggestions = data.results || []; // Extract results array
                let suggestionsHTML = "<h5>Restaurant Suggestions</h5><ul>";
                suggestions.forEach(restaurant => {
                    suggestionsHTML += `<li>${restaurant.name} - ${restaurant.vicinity}</li>`;
                });
                suggestionsHTML += "</ul>";
                $(`#dining-suggestions-${dayNumber}`).html(suggestionsHTML);
            },
            error: function (error) {
                console.error('Error fetching dining suggestions:', error);
                $(`#dining-suggestions-${dayNumber}`).html('<h5>Restaurant Suggestions</h5><p>Error fetching dining suggestions.</p>');
            }
        });
    }

    function fetchLocationHistory(city, dayNumber) {
        console.log(`Fetching location history for city: ${city}`);

        $.ajax({
            url: `/getLocationHistory?location=${encodeURIComponent(city)}`,
            method: 'GET',
            success: function (data) {
                const historyHTML = `<h5>Location History</h5><p>${data.extract || 'No historical information available.'}</p>`;
                $(`#location-history-${dayNumber}`).html(historyHTML);
            },
            error: function (error) {
                console.error('Error fetching location history:', error);
                $(`#location-history-${dayNumber}`).html('<h5>Location History</h5><p>Error fetching historical information.</p>');
            }
        });
    }

    return {
        appendActivityToDOM,
        addActivity,
        addDay,
        autoSaveTrip,
        collectTripData,
        createLabel,
        createInput,
        createSelect,
        deleteActivity,
        deleteDay,
        deriveStartTimes,
        extractCityFromGooglePlace,
        fetchDayLocationData,
        fetchDiningSuggestions,
        fetchLocationHistory,
        generateActivityCard,
        generateActivityHTML,
        generateActivityId,
        generateDayCard,
        generateDayId,
        generateTripHeader,
        handleDeleteDay,
        handleAddActivity,
        handleActivityLengthChange,
        handleActivityReorder,
        initAutocomplete,
        initLodgingAutocomplete,
        initDragAndDrop,
        initializeTripForm,
        loadSavedTrip,
        loadSavedTrips,
        loadTripFromFile,
        recalculateStartTimes,
        removeDayCardFromDOM,
        renderDay,
        saveTrip,
        updateActivityHeaders,
        updateActivityName
    };
})();


$(document).ready(function () {
    console.log("App initialized");

    // Initialize trip form elements dynamically
    TripPlanner.initializeTripForm();

    TripPlanner.loadSavedTrips();

    $('#days-container').on('change', 'input, textarea', function () {
        TripPlanner.autoSaveTrip();
    });

    $('#trip-selector').on('change', function () {
        const selectedTrip = $(this).val();
        console.log(`selectedTrip: ${selectedTrip}`);
        if (selectedTrip === 'new') {
            $('#trip-name').val("New Trip Name"); // Replace with appropriate trip name logic
            $('#start-date').val(new Date().toISOString().split('T')[0]); // Default to today's date

            TripPlanner.addDay([], $('#start-date').val()); // Start a new trip

            return; // Prevent calling `loadTripFromFile` for "New Trip"
        }

        // Load the selected trip if it's not "New Trip"
        TripPlanner.loadTripFromFile(selectedTrip);
    });

    $('#add-day-button').on('click', function () {
        const currentTripData = TripPlanner.collectTripData();
        const updatedTrip = TripPlanner.addDay(currentTripData.trip, currentTripData.startDate);
        currentTripData.trip = updatedTrip;
        TripPlanner.renderDay(updatedTrip.length - 1, currentTripData.startDate);
        TripPlanner.autoSaveTrip(currentTripData);
    });
});
