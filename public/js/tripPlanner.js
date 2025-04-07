function calculateActivityTime(day, activityIndex) {
    const startTime = new Date();
    const [hours, minutes] = day.wakeUpTime.split(":").map(Number);
    startTime.setHours(hours, minutes, 0, 0); // Ensure seconds & ms are 0

    for (let i = 0; i < activityIndex; i++) {
        let duration = parseInt(day.activities[i].length, 10) || 0; // Convert to number safely
        startTime.setMinutes(startTime.getMinutes() + duration);
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

        // ✅ Get the activity index from the old day
        const draggedActivityIndex = parseInt(el.getAttribute("data-activity-index"));

        // ✅ Ensure the index is valid before proceeding
        if (isNaN(draggedActivityIndex) || !tripData.trip[oldDayIndex] || !tripData.trip[newDayIndex]) {
            console.error("Invalid activity index or day index");
            return;
        }

        // ✅ Extract the correct activity object from the old day
        const draggedActivity = tripData.trip[oldDayIndex].activities.splice(draggedActivityIndex, 1)[0];

        // ✅ Find new position in the new day
        const newOrder = [...target.children].map(el => parseInt(el.getAttribute("data-activity-index")));

        // ✅ Ensure we don't lose the dragged activity by inserting it at the correct position
        const siblingIndex = sibling ? parseInt(sibling.getAttribute("data-activity-index")) : tripData.trip[newDayIndex].activities.length;

        // ✅ Insert the dragged activity into the correct position in the new day's list
        tripData.trip[newDayIndex].activities.splice(siblingIndex, 0, draggedActivity);

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
    const displayDate = moment(tripData.startDate, "YYYY-MM-DD").add(dayIndex, "days").format("dddd, MMMM Do YYYY");

    return `
      <div class="day-wrapper" data-day-index="${dayIndex}">

        <!-- 👁️ On-Screen Editable UI -->
        <div class="day-entry card mb-3 p-3 no-print" data-day-index="${dayIndex}">
          <h3>${displayDate}</h3>

          <input type="time" class="form-control wake-up-time" value="${day.wakeUpTime || '08:00'}"
                 data-field="wakeUpTime" data-day-index="${dayIndex}" data-value="${day.wakeUpTime || '08:00'}">

          <input type="text" class="form-control" value="${day.location || ''}"
                 data-field="location" data-day-index="${dayIndex}" data-value="${day.location || ''}">

          <input type="text" class="form-control" value="${day.lodging?.name || ''}"
                 data-field="lodging.name" data-day-index="${dayIndex}" data-value="${day.lodging?.name || ''}">

          <input type="text" class="form-control" value="${day.lodging?.address || ''}"
                 data-field="lodging.address" data-day-index="${dayIndex}" data-value="${day.lodging?.address || ''}">

          <input type="text" class="form-control" value="${day.lodging?.phone || ''}"
                 data-field="lodging.phone" data-day-index="${dayIndex}" data-value="${day.lodging?.phone || ''}">

          <input type="text" class="form-control" value="${day.lodging?.roomType || ''}"
                 data-field="lodging.roomType" data-day-index="${dayIndex}" data-value="${day.lodging?.roomType || ''}">

          <div id="activity-list-${dayIndex}" class="activity-list" data-day-index="${dayIndex}">
            ${day.activities.map((activity, activityIndex) => {
              const time = calculateActivityTime(day, activityIndex);
              return `
                <div class="activity p-2 border mb-2 draggable"
                     data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                  <h4>${time} ${activity.name || ''}</h4>

                  <input type="text" class="form-control" value="${activity.name || ''}"
                         data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="name"
                         data-value="${activity.name || ''}">

                  <input type="number" class="form-control activity-length" value="${activity.length || 0}"
                         data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="length"
                         data-value="${activity.length || 0}">

                  <input type="text" class="form-control" value="${activity.location || ''}"
                         data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="location"
                         data-value="${activity.location || ''}">

                  <textarea class="form-control"
                            data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="notes"
                            data-value="${activity.notes || ''}">${activity.notes || ''}</textarea>

                  <button class="btn btn-danger delete-activity-button"
                          data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                    Delete Activity
                  </button>
                </div>`;
            }).join('')}
          </div>

          <button class="btn btn-primary mt-3 add-activity-button" data-day-index="${dayIndex}">Add Activity</button>
          <button class="btn btn-danger delete-day-button" data-day-index="${dayIndex}">Delete Day</button>
        </div>

        <!-- 🖨️ Hawaii-Style Print-Only Layout -->
        <div class="day-entry print-only">
          ${dayIndex === 0 ? `<div class="trip-header">${tripData.tripName || "Trip"}</div>` : ''}
          <div class="date-line">${displayDate}</div>
          <h1 class="location">${day.location || ''}</h1>

          <div class="hotel-details">
            ${day.lodging?.name || ''}<br>
            ${day.lodging?.address || ''}<br>
            ${day.lodging?.phone || ''}
          </div>

          <hr class="separator">

          <div class="activities">
            ${day.activities.map((activity, i) => {
              const time = calculateActivityTime(day, i);
              return `
                <div class="activity-block">
                  <h1 class="activity-title">${time} ${activity.name || ''}</h1>
                  <p class="activity-notes">${activity.notes || ''}</p>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  initDragAndDrop(tripData);

  // Event handlers preserved
  document.querySelectorAll("input[data-day-index], textarea[data-day-index]").forEach(el => {
    el.addEventListener("blur", async e => {
      const i = parseInt(el.dataset.dayIndex);
      const j = el.dataset.activityIndex;
      const field = el.dataset.field;
      const value = el.value;

      if (j !== undefined && j !== null) {
        await updateActivityField(tripData, i, parseInt(j), field, value);
      } else {
        await updateDayField(tripData, i, field, value);
      }
    });

    el.addEventListener("input", e => {
      e.target.setAttribute("data-value", e.target.value);
    });
  });

  document.querySelectorAll(".wake-up-time").forEach(input => {
    input.addEventListener("input", async e => {
      const i = parseInt(e.target.dataset.dayIndex);
      const value = e.target.value;
      await updateDayField(tripData, i, "wakeUpTime", value);
      renderTrip(tripData);
    });
  });

  document.querySelectorAll(".activity-length").forEach(input => {
    input.addEventListener("input", async e => {
      const i = parseInt(e.target.dataset.dayIndex);
      const j = parseInt(e.target.dataset.activityIndex);
      const value = parseInt(e.target.value) || 0;
      await updateActivityField(tripData, i, j, "length", value);
      renderTrip(tripData);
    });
  });

  document.querySelectorAll(".delete-day-button").forEach(btn =>
    btn.addEventListener("click", async e => {
      const i = parseInt(e.target.dataset.dayIndex);
      await handleDeleteDay(tripData, i);
    })
  );

  document.querySelectorAll(".delete-activity-button").forEach(btn =>
    btn.addEventListener("click", async e => {
      const i = parseInt(e.target.dataset.dayIndex);
      const j = parseInt(e.target.dataset.activityIndex);
      await handleDeleteActivity(tripData, i, j);
    })
  );
}
