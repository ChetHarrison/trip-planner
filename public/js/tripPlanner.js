// ✅ Formats a date to "Wednesday, January 1st, 2020"
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

// ✅ Calculates a day's date based on the trip start date
function calculateDayDate(startDate, dayIndex) {
    let date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    return date;
}

// ✅ Computes activity start time based on previous durations
function calculateActivityTime(day, activityIndex) {
    const startTime = new Date();
    const [hours, minutes] = day.wakeUpTime.split(":").map(Number);
    startTime.setHours(hours, minutes);

    for (let i = 0; i < activityIndex; i++) {
        startTime.setMinutes(startTime.getMinutes() + (day.activities[i].length || 0));
    }

    return startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

export function initDragAndDrop(tripData) {
    const containers = document.querySelectorAll(".activity-list");

    const dragulaInstance = dragula([...containers], {
        moves: (el) => el.classList.contains("draggable"),
        accepts: (el, target) => target.classList.contains("activity-list"),
    });

    dragulaInstance.on("drop", async (el, target, source, sibling) => {
        const oldDayIndex = parseInt(source.closest(".day-entry").getAttribute("data-day-index"));
        const newDayIndex = parseInt(target.closest(".day-entry").getAttribute("data-day-index"));

        // ✅ Convert NodeList to array to get correct order
        const newOrder = [...target.children].map(el => parseInt(el.getAttribute("data-activity-index")));

        // ✅ Reorder JSON activities to match the DOM order
        tripData.trip[newDayIndex].activities = newOrder.map(i => tripData.trip[newDayIndex].activities[i]);

        // ✅ Fix: Save JSON first before rendering
        updateActivityIndices(tripData);
        await saveTripData(tripData);
        renderTrip(tripData);
    });

    console.log("✅ Drag-and-drop initialized");
}

export function ensureEmptyDayHasList(dayIndex) {
    const dayContainer = document.querySelector(`[data-day-index="${dayIndex}"] .activity-list`);

    if (!dayContainer || dayContainer.children.length === 0) {
        dayContainer.innerHTML = `<p class="text-muted">Drag activities here</p>`;
    }
}

export async function reorderActivities(tripData, dayIndex, newOrder) {
    tripData.trip[dayIndex].activities = newOrder.map(index => tripData.trip[dayIndex].activities[index]);

    updateActivityIndices(tripData); // ✅ Recalculate times & order
    await saveTripData(tripData);
    renderTrip(tripData);
}

export async function handleDeleteActivity(tripData, dayIndex, activityIndex) {
    tripData.trip[dayIndex].activities.splice(activityIndex, 1);
    updateActivityIndices(tripData);
    await saveTripData(tripData);
    renderTrip(tripData);
}

// 🔹 1️⃣ Fetch all available trips
export async function fetchTrips() {
    try {
        const response = await fetch('/getTrips');
        return await response.json();
    } catch (error) {
        console.error("Error fetching trips:", error);
        return [];
    }
}

// 🔹 2️⃣ Fetch a specific trip's data (✅ NO GLOBAL `tripData`)
export async function fetchTripData(tripName) {
    try {
        const response = await fetch(`/getTrip?tripName=${tripName}`);
        return await response.json(); // ✅ Return data instead of modifying a global variable
    } catch (error) {
        console.error(`Error fetching trip ${tripName}:`, error);
        return null;
    }
}

// 🔹 3️⃣ Save trip data (✅ Now takes `tripData` as an argument)
export async function saveTripData(tripData) {
    if (!tripData) return;
    try {
        await fetch('/saveTrip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData),
        });
    } catch (error) {
        console.error("Error saving trip:", error);
    }
}

// 🔹 4️⃣ Load the trip selector dropdown
export async function loadTripSelector() {
    const trips = await fetchTrips();
    const selector = document.getElementById('trip-selector');
    selector.innerHTML = `<option value="">Select a trip</option>
                          <option value="new">New Trip</option>`;

    trips.forEach(trip => {
        selector.innerHTML += `<option value="${trip}">${trip.replace('.json', '')}</option>`;
    });
}

// 🔹 5️⃣ Handle trip selection (✅ No global `tripData`, passes data explicitly)
export async function handleTripSelection(tripName) {
    if (tripName === "new") {
        document.getElementById("trip-name").value = "";
        document.getElementById("trip-start-date").value = "";
        renderTrip({ tripName: "", startDate: "", trip: [] }); // ✅ Pass empty trip object
        return;
    }

    const tripData = await fetchTripData(tripName);
    if (tripData) {
        renderTrip(tripData);
    }
}

export async function handleDeleteDay(tripData, dayIndex) {
    if (!tripData || !tripData.trip[dayIndex]) return;

    tripData.trip.splice(dayIndex, 1); // ✅ Remove the day

    await saveTripData(tripData);
    renderTrip(tripData);
}

// 🔹 6️⃣ Create a new trip (✅ No global `tripData`)
export async function createNewTrip() {
    const tripName = document.getElementById("trip-name").value.trim();
    const startDate = document.getElementById("trip-start-date").value;

    if (!tripName || !startDate) {
        alert("Please enter a trip name and start date.");
        return;
    }

    const tripData = { tripName, startDate, trip: [] }; // ✅ Local variable instead of a global state

    await saveTripData(tripData);
    await loadTripSelector();
    renderTrip(tripData);
}

// 🔹 7️⃣ Add a new day (✅ Now takes `tripData` as an argument)
export async function handleAddDay(tripData) {
    if (!tripData) return;

    const newDay = {
        wakeUpTime: "08:00",
        location: "",
        lodging: { name: "", address: "", phone: "", roomType: "" },
        activities: []
    };

    tripData.trip.push(newDay);

    await saveTripData(tripData);
    renderTrip(tripData);
}

// 🔹 8️⃣ Add an activity (✅ No global `tripData`)
export async function handleAddActivity(tripData, dayIndex) {
    if (!tripData || !tripData.trip[dayIndex]) return;

    const newActivity = { name: "", length: 0, location: "", notes: "" };

    tripData.trip[dayIndex].activities.push(newActivity); // ✅ Always push a valid activity object

    await saveTripData(tripData);
    renderTrip(tripData);
}

export function updateActivityIndices(tripData) {
    // ✅ Ensure DOM elements reflect new activity order
    document.querySelectorAll(".activity-list").forEach((list) => {
        [...list.children].forEach((el, newIndex) => {
            el.setAttribute("data-activity-index", newIndex);
        });
    });
}

// 🔹 9️⃣ Update day field (✅ Prevents activity fields from modifying the day)
export async function updateDayField(tripData, dayIndex, field, value) {
    if (!tripData || !tripData.trip[dayIndex]) return;

    let fieldParts = field.split('.');
    let obj = tripData.trip[dayIndex];

    while (fieldParts.length > 1) {
        obj = obj[fieldParts.shift()];
    }

    obj[fieldParts[0]] = value; // ✅ Direct update—no validation needed

    await saveTripData(tripData);
}

// 🔹 🔟 Update activity field (✅ No global `tripData`)
export async function updateActivityField(tripData, dayIndex, activityIndex, field, value) {
    if (!tripData || !tripData.trip[dayIndex] || !tripData.trip[dayIndex].activities[activityIndex]) return;

    tripData.trip[dayIndex].activities[activityIndex][field] = value;
    await saveTripData(tripData);
}

function addMinutes(time, minutes) {
    let [hour, minute] = time.split(":").map(Number);
    let date = new Date();
    date.setHours(hour);
    date.setMinutes(minute + minutes);

    let newHour = date.getHours();
    let newMinute = date.getMinutes();
    let period = newHour >= 12 ? "PM" : "AM";

    // Convert to 12-hour format
    newHour = newHour % 12 || 12;

    return `${newHour}:${newMinute.toString().padStart(2, "0")} ${period}`;
}

export function renderTrip(tripData) {
    if (!tripData) return;

    const daysContainer = document.getElementById("days-container");

    daysContainer.innerHTML = tripData.trip.map((day, dayIndex) => {
        let activityStartTime = day.wakeUpTime || "08:00"; // Start with the day's wake-up time

        return `
        <div class="day-entry card mb-3 p-3" data-day-index="${dayIndex}">
            <h3>${formatDate(calculateDayDate(tripData.startDate, dayIndex))}</h3>

            <button class="btn btn-danger delete-day-button" data-day-index="${dayIndex}">Delete Day</button>

            <label for="wake-up-time-${dayIndex}" class="form-label">Start Time:</label>
            <input type="time" class="form-control wake-up-time" value="${day.wakeUpTime || '08:00'}"
                   data-field="wakeUpTime" data-day-index="${dayIndex}">

            <h5>Location</h5>
            <label for="location-${dayIndex}" class="form-label">Location:</label>
            <input type="text" class="form-control" value="${day.location || ''}"
                   data-field="location" data-day-index="${dayIndex}">

            <h5>Accommodation</h5>
            <label for="lodging-name-${dayIndex}" class="form-label">Lodging Name:</label>
            <input type="text" class="form-control" value="${day.lodging?.name || ''}"
                   data-field="lodging.name" data-day-index="${dayIndex}">

            <label for="lodging-address-${dayIndex}" class="form-label">Address:</label>
            <input type="text" class="form-control" value="${day.lodging?.address || ''}"
                   data-field="lodging.address" data-day-index="${dayIndex}">

            <label for="lodging-phone-${dayIndex}" class="form-label">Phone:</label>
            <input type="text" class="form-control" value="${day.lodging?.phone || ''}"
                   data-field="lodging.phone" data-day-index="${dayIndex}">

            <label for="lodging-roomType-${dayIndex}" class="form-label">Room Type:</label>
            <input type="text" class="form-control" value="${day.lodging?.roomType || ''}"
                   data-field="lodging.roomType" data-day-index="${dayIndex}">

            <h5>Activities</h5>
            <div id="activity-list-${dayIndex}" class="activity-list" data-day-index="${dayIndex}">
                ${day.activities.map((activity, activityIndex) => {
                    let formattedTime = calculateActivityTime(day, activityIndex); // ✅ Derived, NOT stored

                    return `
                    <div class="activity p-2 border mb-2 draggable"
                         data-day-index="${dayIndex}" data-activity-index="${activityIndex}">

                        <h4>${formattedTime} ${activity.name || ''}</h4>

                        <label>Activity Name:</label>
                        <input type="text" class="form-control" value="${activity.name || ''}"
                               data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="name">

                        <label>Length (minutes):</label>
                        <input type="number" class="form-control activity-length" value="${activity.length || 0}"
                               data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="length">

                        <label>Location:</label>
                        <input type="text" class="form-control" value="${activity.location || ''}"
                               data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="location">

                        <label>Notes:</label>
                        <textarea class="form-control"
                                  data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="notes">${activity.notes || ''}</textarea>

                        <button class="btn btn-danger delete-activity-button"
                                data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                            Delete Activity
                        </button>
                    </div>`;
                }).join('')}
            </div>

            <button class="btn btn-primary mt-3 add-activity-button" data-day-index="${dayIndex}">Add Activity</button>
        </div>`;
    }).join('');

    initDragAndDrop(tripData); // ✅ Ensure drag-and-drop is re-initialized

    // ✅ Attach event listeners for deleting days
    document.querySelectorAll(".delete-day-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            await handleDeleteDay(tripData, dayIndex);
        });
    });

    // ✅ Attach event listeners for deleting activities
    document.querySelectorAll(".delete-activity-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const activityIndex = parseInt(e.target.getAttribute("data-activity-index"));
            await handleDeleteActivity(tripData, dayIndex, activityIndex);
        });
    });

    // ✅ Save changes to fields on blur
    document.querySelectorAll("input[data-day-index], textarea[data-day-index]").forEach(input => {
        input.addEventListener("blur", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const activityIndex = e.target.getAttribute("data-activity-index");
            const field = e.target.getAttribute("data-field");
            const value = e.target.value;

            if (activityIndex !== null && activityIndex !== undefined) {
                await updateActivityField(tripData, dayIndex, parseInt(activityIndex), field, value);
            } else {
                await updateDayField(tripData, dayIndex, field, value);
            }
        });
    });

    // ✅ Listen for day start time changes and update activity times
    document.querySelectorAll(".wake-up-time").forEach(input => {
        input.addEventListener("input", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const value = e.target.value;
            await updateDayField(tripData, dayIndex, "wakeUpTime", value);
            renderTrip(tripData); // Re-render to update times
        });
    });

    // ✅ Listen for activity length changes and update activity times
    document.querySelectorAll(".activity-length").forEach(input => {
        input.addEventListener("input", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const activityIndex = parseInt(e.target.getAttribute("data-activity-index"));
            const value = parseInt(e.target.value) || 0;
            await updateActivityField(tripData, dayIndex, activityIndex, "length", value);
            renderTrip(tripData); // Re-render to update times
        });
    });
}

function attachEventListeners(tripData) {
    document.querySelectorAll(".add-activity-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            await handleAddActivity(tripData, dayIndex);
        });
    });

    document.querySelectorAll(".delete-day-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            await handleDeleteDay(tripData, dayIndex);
        });
    });

    document.querySelectorAll(".delete-activity-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const activityIndex = parseInt(e.target.getAttribute("data-activity-index"));
            await handleDeleteActivity(tripData, dayIndex, activityIndex);
        });
    });

    document.querySelectorAll("input[data-day-index], textarea[data-day-index]").forEach(input => {
        input.addEventListener("blur", async (e) => {
            const dayIndex = parseInt(e.target.getAttribute("data-day-index"));
            const activityIndex = e.target.getAttribute("data-activity-index");
            const field = e.target.getAttribute("data-field");
            const value = e.target.value;

            if (activityIndex !== null && activityIndex !== undefined) {
                await updateActivityField(tripData, dayIndex, parseInt(activityIndex), field, value);
            } else {
                await updateDayField(tripData, dayIndex, field, value);
            }
        });
    });
}
