const TripPlanner = (function () {
    // PURE FUNCTIONS

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

        const newActivity = { name: "Unnamed Activity", length: 0, location: "", company: "", notes: "" };
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
        const tripData = [];

        $('.day-card').each(function (index) {
            const dayNumber = index + 1;
            const wakeUpTime = $(`#wake-up-time-${dayNumber}`).val();
            const lodging = {
                name: $(`#lodging-name-${dayNumber}`).val(),
                address: $(`#lodging-address-${dayNumber}`).val(),
                phone: $(`#lodging-phone-${dayNumber}`).val()
            };

            const activities = [];
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

            tripData.push({ wakeUpTime, lodging, activities });
        });

        const tripState = { tripName, startDate, trip: tripData };
        // console.log($(`collectTripData()\n${JSON.stringify(tripState)}`));

        return tripState;
    }

    function deleteActivity(dayIndex, activityIndex) {
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
                headerElement.textContent = `${startTimes[newIndex]} - ${activity.name || "Unnamed Activity"}`;
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
            <div class="card mb-2 draggable" id="${activityId}">
                <div class="card-header activity-header" id="activity-header-${activityId}">
                    ${startTime} - ${activity.name || "Unnamed Activity"}
                </div>
                <div class="card-body">
                    <label for="activity-name-${activityId}">Activity Name:</label>
                    <input type="text" class="form-control mb-2 activity-name"
                           id="activity-name-${activityId}"
                           placeholder="Activity Name"
                           value="${activity.name || ''}"
                           oninput="TripPlanner.updateActivityName(${dayIndex}, '${activityId}')">

                    <label for="activity-length-${activityId}">Length (minutes):</label>
                    <input type="number" class="form-control mb-2 activity-length"
                           id="activity-length-${activityId}"
                           placeholder="Length (minutes)"
                           value="${activity.length || ''}"
                           onchange="TripPlanner.handleActivityLengthChange(${dayIndex})">

                    <label for="activity-location-${activityId}">Location:</label>
                    <input type="text" class="form-control mb-2 activity-location"
                           id="activity-location-${activityId}"
                           placeholder="Location"
                           value="${activity.location || ''}">

                    <label for="activity-company-${activityId}">Company:</label>
                    <input type="text" class="form-control mb-2 activity-company"
                           id="activity-company-${activityId}"
                           placeholder="Company"
                           value="${activity.company || ''}">

                <label for="activity-notes-${activityId}">Notes:</label>
                <textarea class="form-control mb-2 activity-notes"
                          id="activity-notes-${activityId}"
                          placeholder="Notes">${activity.notes || ''}</textarea>

                <button type="button" onclick="TripPlanner.deleteActivity(${dayIndex}, '${activityId}')"
                        class="btn btn-danger mt-3">Delete Activity</button>
                </div>
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

    function generateDayCard(dayNumber, dayDate) {
        return `
            <div class="card day-card mb-3" id="day-${dayNumber}">
                <h3>Day ${dayNumber}, ${dayDate}</h3>
                <div>
                    <label for="wake-up-time-${dayNumber}">Wake Up Time:</label>
                    <input type="time" id="wake-up-time-${dayNumber}" class="form-control">
                </div>
                <div class="mb-3">
                    <h5>Lodging</h5>
                    <label for="lodging-name-${dayNumber}">Name:</label>
                    <input type="text" class="form-control mb-2 pac-target-input" id="lodging-name-${dayNumber}" placeholder="Enter name" autocomplete="off">
                    <label for="lodging-address-${dayNumber}">Address:</label>
                    <input type="text" class="form-control mb-2" id="lodging-address-${dayNumber}" placeholder="Enter address">
                    <label for="lodging-phone-${dayNumber}">Phone:</label>
                    <input type="text" class="form-control mb-2" id="lodging-phone-${dayNumber}" placeholder="Enter phone number">
                </div>
                <div id="activity-list-${dayNumber}" class="activity-list"></div>
                <button type="button" onclick="TripPlanner.handleAddActivity(${dayNumber - 1})" class="btn btn-primary mt-3">Add Activity</button>
                <button type="button" onclick="TripPlanner.handleDeleteDay(${dayNumber - 1})" class="btn btn-danger mt-3">Delete Day</button>
            </div>
        `;
    }

    function generateDayId(dayIndex) {
        return `day-${dayIndex + 1}`;
    }

    function generatePublishedTripHTML(tripData) {
        let tripHTML = `<h1>${tripData.tripName}</h1>`;

        tripData.trip.forEach((day, dayIndex) => {
            // Calculate the date for the current day
            const dayDate = moment(tripData.startDate).add(dayIndex, 'days').format('MMMM Do, YYYY');

            // Generate lodging information
            const lodging = day.lodging;
            const lodgingHTML = `
                <h3>Day ${dayIndex + 1}: ${dayDate}</h3>
                <p><strong>Location:</strong> ${lodging.name || "No lodging name specified"}</p>
                <p><strong>Address:</strong> ${lodging.address || "No address specified"}</p>
                <p><strong>Phone:</strong> ${lodging.phone || "No phone number specified"}</p>
            `;

            // Generate HTML for activities
            const activitiesHTML = day.activities.map((activity, activityIndex) => {
                return `
                    <div class="activity">
                        <p><strong>Activity ${activityIndex + 1}:</strong> ${activity.name || "Unnamed Activity"}</p>
                        <p><strong>Duration:</strong> ${activity.length || "N/A"} minutes</p>
                        <p><strong>Location:</strong> ${activity.location || "No location specified"}</p>
                        <p><strong>Company:</strong> ${activity.company || "No company specified"}</p>
                        <p><strong>Notes:</strong> ${activity.notes || "No notes"}</p>
                    </div>
                `;
            }).join('');

            // Combine the day's lodging and activities HTML
            tripHTML += `
                <div class="day">
                    ${lodgingHTML}
                    <div class="activities">
                        <h4>Activities:</h4>
                        ${activitiesHTML}
                    </div>
                </div>
                <hr>
            `;
        });

        return tripHTML;
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
            TripPlanner.initAutocomplete(document.getElementById(`activity-company-${activityId}`), dayIndex, 'activity');
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
                headerElement.textContent = `${startTime} - ${activity.name || "Unnamed Activity"}`;
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
                headerElement.textContent = `${activity.calculatedStartTime} - ${activity.name || "Unnamed Activity"}`;
            }
        });

        // Save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    function handleDeleteDay(dayIndex) {
        // Get updated trip data after deleting the specified day
        const updatedTripData = TripPlanner.deleteDay(dayIndex);

        // Re-render the trip with the updated trip data
        renderTrip(updatedTripData);

        // Save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    function initAutocomplete(input, dayNumber, type) {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.addListener('place_changed', function () {
            const place = autocomplete.getPlace();
            if (type === 'lodging') {
                $(`#lodging-address-${dayNumber}`).val(place.formatted_address || '');
                $(`#lodging-phone-${dayNumber}`).val(place.formatted_phone_number || '');
            }
            if (type === 'activity') {
                $(`#activity-location-${dayNumber}`).val(place.formatted_address || '');
            }

            // Automatically save the updated trip data
            TripPlanner.autoSaveTrip();
        });
    }

    function initDragAndDrop(dayIndex) {
        const container = document.getElementById(`activity-list-${dayIndex + 1}`);
        const drake = dragula([container]);

        drake.on('drop', function(el, target, source, sibling) {
            // After drop, reorder activities and update start times
            TripPlanner.handleActivityReorder(dayIndex);
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
                headerElement.textContent = `${startTime} - ${activityName || "Unnamed Activity"}`;
            }
        });

        // Automatically save the updated trip data
        TripPlanner.autoSaveTrip();
    }

    async function loadSavedTrip(tripDataFromFile) {
        console.log(tripDataFromFile);

        $('#trip-name').val(tripDataFromFile.tripName);
        $('#start-date').val(tripDataFromFile.startDate);

        // Render the trip using the shared function
        renderTrip(tripDataFromFile);

        // Save the recalculated trip data
        TripPlanner.autoSaveTrip();
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
        const dayDate = moment(startDate).add(dayIndex, 'days').format('MMMM Do, YYYY');
        const dayCardHTML = TripPlanner.generateDayCard(dayNumber, dayDate);
        $('#days-container').append(dayCardHTML);

        // Initialize components as needed (e.g., autocomplete, drag-and-drop)
        TripPlanner.initAutocomplete(document.getElementById(`lodging-name-${dayNumber}`), dayNumber, 'lodging');
        TripPlanner.initDragAndDrop();
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

            TripPlanner.initAutocomplete(document.getElementById(`lodging-name-${dayNumber}`), dayNumber, 'lodging');
            TripPlanner.initDragAndDrop(dayIndex);
        });
    }

    function saveTrip(tripData) {
        if (!tripData.tripName || !tripData.startDate) {
            alert('Please enter a trip name and start date.');
            return;
        }

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

    return {
        appendActivityToDOM,
        addActivity,
        addDay,
        autoSaveTrip,
        collectTripData,
        deleteActivity,
        deleteDay,
        deriveStartTimes,
        generateActivityCard,
        generateActivityHTML,
        generateActivityId,
        generateDayCard,
        generateDayId,
        generatePublishedTripHTML,
        handleDeleteDay,
        handleAddActivity,
        handleActivityLengthChange,
        handleActivityReorder,
        initAutocomplete,
        initDragAndDrop,
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

    TripPlanner.loadSavedTrips();

    $('#days-container').on('change', 'input, textarea', function () {
        TripPlanner.autoSaveTrip();
    });

    $('#trip-selector').on('change', function () {
        const selectedTrip = $(this).val();
        if (selectedTrip === 'new') {
            TripPlanner.addDay([], 0, $('#start-date').val()); // Start a new trip
        } else {
            TripPlanner.loadTripFromFile(selectedTrip);  // Load the selected trip
        }
    });

    $('#add-day-button').on('click', function () {
        // Collect the current trip data
        const currentTripData = TripPlanner.collectTripData();

        // Add a new day to the trip data
        const updatedTrip = TripPlanner.addDay(currentTripData.trip, currentTripData.startDate);
        currentTripData.trip = updatedTrip; // Update currentTripData with the new trip array

        // Render the new day in the DOM
        TripPlanner.renderDay(updatedTrip.length - 1, currentTripData.startDate);

        // Save the updated trip data as a single object
        TripPlanner.autoSaveTrip(currentTripData);
    });

    $('#publish-trip-button').on('click', function () {
        const tripData = TripPlanner.collectTripData();
        const tripHTML = TripPlanner.generatePublishedTripHTML(tripData);
        const newWindow = window.open();
        newWindow.document.write(`
            <html>
                <head>
                    <title>${tripData.tripName}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            margin: 20px;
                            padding: 0;
                        }
                        h1 {
                            text-align: center;
                            font-size: 2.5em;
                            margin-bottom: 20px;
                        }
                        .date-header {
                            font-size: 1.5em;
                            font-weight: bold;
                            margin-top: 30px;
                            margin-bottom: 10px;
                        }
                        .activity {
                            margin-bottom: 20px;
                        }
                        .activity-time {
                            font-weight: bold;
                            font-size: 1.2em;
                        }
                        .activity-location, .activity-notes {
                            font-size: 1em;
                        }
                    </style>
                </head>
                <body>
                    ${tripHTML}
                </body>
            </html>
        `);
    });
});
