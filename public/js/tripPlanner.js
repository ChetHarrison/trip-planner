import { memoizeAsyncPersistent } from './utils/memoize.js';
import { sanitizeForWikipedia, isSight } from './utils/helpers.js';

function debounce(fn, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function getLocationSuggestions(location, apiKey) {
    const cleanedLocation = sanitizeForWikipedia(location);

    const [restaurantsRes, sightsRes, wikiRes] = await Promise.all([
        fetch(`/getDiningSuggestions?location=${encodeURIComponent(location)}`),
        fetch(`/getSiteSuggestions?location=${encodeURIComponent(location)}`),
        fetch(`/getLocationHistory?location=${encodeURIComponent(cleanedLocation)}`)
    ]);

    const restaurantsData = await restaurantsRes.json();
    const sightsData = await sightsRes.json();
    const wiki = await wikiRes.json();

    const restaurants = restaurantsData.results
      .filter(p => p.types?.includes("restaurant"))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        formatted_address: p.formatted_address,
        place_id: p.place_id
      }));

    const sights = sightsData.results
      .filter(isSight)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        formatted_address: p.formatted_address,
        place_id: p.place_id
      }));

    return {
        restaurants,
        sights,
        history: wiki?.extract || ""
    };
}

const getMemoizedLocationSuggestions = memoizeAsyncPersistent(getLocationSuggestions);

export const fetchSightsAndRestaurantsAndHistory = debounce(
    async function (location, dayIndex, apiKey, tripData) {
        const dayEl = document.querySelector(`.day-entry[data-day-index="${dayIndex}"]`);
        if (!dayEl) return;

        try {
            const suggestions = await getMemoizedLocationSuggestions(location, apiKey);
            tripData.trip[dayIndex].suggestions = suggestions;
            await saveTripData(tripData);
            renderTrip(tripData, apiKey);
            hydrateClassicAutocompleteInputs();
        } catch (err) {
            console.error("❌ Failed to fetch sights or history:", err);
        }
    },
    500
);

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

export function hydrateClassicAutocompleteInputs() {
        document.querySelectorAll('input.day-location').forEach(input => {
            const autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.addListener('place_changed', async () => {
                const place = autocomplete.getPlace();
                const dayIndex = input.dataset.dayIndex;
                if (place?.formatted_address) {
                    input.value = place.formatted_address;
                    input.dispatchEvent(new Event('blur'));
                }
            });
        });

        document.querySelectorAll('input.activity-location').forEach(input => {
            const autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.addListener('place_changed', async () => {
                const place = autocomplete.getPlace();
                if (place?.name) {
                    input.value = place.name;
                    input.dispatchEvent(new Event('blur'));
                }
            });
        });

        document.querySelectorAll('input.hotel-name').forEach(input => {
            const autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.addListener('place_changed', async () => {
                const place = autocomplete.getPlace();
                const dayIndex = input.dataset.dayIndex;
                input.value = place.name;
                document.querySelector(`input[data-field="lodging.address"][data-day-index="${dayIndex}"]`).value = place.formatted_address || "";
                document.querySelector(`input[data-field="lodging.phone"][data-day-index="${dayIndex}"]`).value = place.formatted_phone_number || "";
                input.dispatchEvent(new Event('blur'));
            });
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

    console.log("Trip size (KB):", JSON.stringify(tripData).length / 1024);

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

export function renderTrip(tripData, apiKey) {
    if (!tripData) return;

    const daysContainer = document.getElementById("days-container");

    // Add this helper here:
    function formatSuggestionSection(suggestions, location, apiKey) {
        const formatCardsRow = (label, list) => {
            if (!list?.length) return "";
            return `
                <h5 class="mt-3">${label}</h5>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${list.map(p => `
                        <div style="flex: 1 1 calc(20% - 10px); min-width: 200px;">
                            <strong>${p.name}</strong><br>
                            ${p.formatted_address}<br>
                            ${p.place_id && apiKey ? `<iframe width="100%" height="200" frameborder="0" style="margin-top:5px"
                                src="https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${p.place_id}" allowfullscreen></iframe>` : ''}
                        </div>
                    `).join("")}
                </div>
            `;
        };

        return `
            <div class="day-info-section">
                ${formatCardsRow("Top 5 Restaurants Nearby", suggestions.restaurants)}
                ${formatCardsRow("Top 5 Tourist Sights", suggestions.sights)}
                ${suggestions.history ? `<div class="mt-4"><h5>History of ${location}</h5><p>${suggestions.history}</p></div>` : ""}
            </div>
        `;
    }

    daysContainer.innerHTML = tripData.trip.map((day, dayIndex) => {
        const displayDate = moment(tripData.startDate, "YYYY-MM-DD")
            .add(dayIndex, "days")
            .format("dddd, MMMM Do YYYY");

        // PRINT SECTION (Only visible in print)
        const printSection = `
            <div class="day-entry print-only" data-day-index="${dayIndex}">
                ${dayIndex === 0 ? `<div class="trip-header">${tripData.tripName || "Trip"}</div>` : ""}
                <div class="date-line">${displayDate}</div>
                <h1 class="location">${day.location || ""}</h1>
                <div class="hotel-details">
                    ${day.lodging?.name || ""}<br>
                    ${day.lodging?.address || ""}<br>
                    ${day.lodging?.phone ? `Phone: ${day.lodging.phone}<br>` : ""}
                    ${day.lodging?.roomType ? `Room: ${day.lodging.roomType}` : ""}
                </div>
                <hr class="separator">
                <div class="activities">
                    ${day.activities.map((activity, i) => {
                        const time = calculateActivityTime(day, i);
                        return `
                            <div class="activity-block">
                                <h1 class="activity-title">${time} ${activity.name || ""}</h1>
                                ${activity.location ? `<p class="activity-location">📍 ${activity.location}</p>` : ""}
                                ${activity.notes ? `<p class="activity-notes"><strong>Notes:</strong> ${activity.notes}</p>` : ""}
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;

        // SCREEN FORM SECTION
        const formSection = `
            <div class="day-entry card mb-3 p-3" data-day-index="${dayIndex}">
                <h3>${displayDate}</h3>

                <div class="row mb-2">
                    <label class="col-2 col-form-label">Start Time:</label>
                    <div class="col-10">
                        <input type="time" class="form-control wake-up-time" value="${day.wakeUpTime || "08:00"}"
                            data-field="wakeUpTime" data-day-index="${dayIndex}">
                    </div>
                </div>

                <div class="row mb-2">
                    <label class="col-2 col-form-label">Location:</label>
                    <div class="col-10">
                        <input
                          type="text"
                          class="form-control day-location"
                          value="${day.location || ""}"
                          placeholder="Search location..."
                          data-field="location"
                          data-day-index="${dayIndex}"
                        >
                    </div>
                </div>

                <div class="row mb-2">
                    <label class="col-2 col-form-label">Hotel Name:</label>
                    <div class="col-10">
                        <input
                            type="text"
                            class="form-control hotel-name"
                            value="${day.lodging?.name || ""}"
                            placeholder="Search hotel..."
                            data-field="lodging.name"
                            data-day-index="${dayIndex}"
                        >
                    </div>
                </div>

                <div class="row mb-2">
                    <label class="col-2 col-form-label">Address:</label>
                    <div class="col-10">
                        <input
                            type="text"
                            class="form-control"
                            value="${day.lodging?.address || ""}"
                            placeholder="Hotel address"
                            data-field="lodging.address"
                            data-day-index="${dayIndex}"
                        >
                    </div>
                </div>

                <div class="row mb-2">
                    <label class="col-2 col-form-label">Phone:</label>
                    <div class="col-10">
                        <input
                          type="text"
                          class="form-control"
                          value="${day.lodging?.phone || ""}"
                          placeholder="Hotel phone"
                          data-field="lodging.phone"
                          data-day-index="${dayIndex}"
                        >
                    </div>
                </div>

                <div class="row mb-3">
                    <label class="col-2 col-form-label">Room Type:</label>
                    <div class="col-10">
                        <input
                          type="text"
                          class="form-control"
                          value="${day.lodging?.roomType || ""}"
                          placeholder="Room type"
                          data-field="lodging.roomType"
                          data-day-index="${dayIndex}"
                        >
                    </div>
                </div>

                ${day.suggestions ? formatSuggestionSection(day.suggestions, day.location, apiKey) : ""}

                <div id="activity-list-${dayIndex}" class="activity-list" data-day-index="${dayIndex}">
                    ${day.activities.map((activity, activityIndex) => {
                        const time = calculateActivityTime(day, activityIndex);
                        return `
                            <div class="activity p-2 border mb-3 draggable"
                                data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                                <h4>${time} ${activity.name || ""}</h4>

                                <div class="row mb-2">
                                    <label class="col-2 col-form-label">Name:</label>
                                    <div class="col-10">
                                        <input type="text" class="form-control" value="${activity.name || ""}"
                                            data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="name">
                                    </div>
                                </div>

                                <div class="row mb-2">
                                    <label class="col-2 col-form-label">Length (min):</label>
                                    <div class="col-10">
                                        <input type="number" class="form-control activity-length" value="${activity.length || 0}"
                                            data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="length">
                                    </div>
                                </div>

                                <div class="row mb-2">
                                    <label class="col-2 col-form-label">Location:</label>
                                    <div class="col-10">
                                        <input
                                          type="text"
                                          class="form-control activity-location"
                                          value="${activity.location || ""}"
                                          placeholder="Search location..."
                                          data-field="location"
                                          data-day-index="${dayIndex}"
                                          data-activity-index="${activityIndex}"
                                        >
                                    </div>
                                </div>

                                <div class="row mb-2">
                                    <label class="col-2 col-form-label">Notes:</label>
                                    <div class="col-10">
                                        <textarea class="form-control" rows="2"
                                            data-day-index="${dayIndex}" data-activity-index="${activityIndex}" data-field="notes">${activity.notes || ""}</textarea>
                                    </div>
                                </div>

                                <button class="btn btn-danger delete-activity-button mt-2"
                                    data-day-index="${dayIndex}" data-activity-index="${activityIndex}">
                                    Delete Activity
                                </button>
                            </div>`;
                    }).join("")}
                </div>

                <button class="btn btn-primary mt-3 add-activity-button" data-day-index="${dayIndex}">Add Activity</button>
                <button class="btn btn-danger delete-day-button" data-day-index="${dayIndex}">Delete Day</button>
            </div>
        `;

        // ✅ Return both versions split by visibility class
        return `
        <div class="day-wrapper print-only" data-day-index="${dayIndex}">
            ${printSection}
        </div>
        <div class="day-wrapper no-print" data-day-index="${dayIndex}">
            ${formSection}
        </div>
    `;
    }).join("");

    initDragAndDrop(tripData);
    setupInputHandlers(tripData, apiKey);
}

export function setupInputHandlers(tripData, apiKey) {
    // Update fields on blur (user finishes editing)
    document.querySelectorAll("input[data-day-index], textarea[data-day-index]").forEach(el => {
        el.addEventListener("blur", async e => {
            const i = parseInt(el.dataset.dayIndex);
            const j = el.dataset.activityIndex;
            const field = el.dataset.field;
            const value = el.value;

            if (j !== undefined && j !== null) {
                await updateActivityField(tripData, i, parseInt(j), field, value);
                renderTrip(tripData, apiKey); // Optional: re-render if you want to see length effects
                hydrateClassicAutocompleteInputs();
            } else {
                await updateDayField(tripData, i, field, value);

                if (field === "location" && value.trim()) {
                    await fetchSightsAndRestaurantsAndHistory(value, i, apiKey, tripData); // Only suggestions
                } else if (field === "wakeUpTime") {
                    renderTrip(tripData, apiKey); // Recalculate times
                    hydrateClassicAutocompleteInputs();
                }
            }
        });

        el.addEventListener("input", e => {
            e.target.setAttribute("data-value", e.target.value);
        });
    });

    // Wake-up time triggers recalculation
    document.querySelectorAll(".wake-up-time").forEach(input => {
        input.addEventListener("input", async e => {
            const i = parseInt(e.target.dataset.dayIndex);
            const value = e.target.value;
            await updateDayField(tripData, i, "wakeUpTime", value);
            renderTrip(tripData, apiKey); // Recalculate start times
            hydrateClassicAutocompleteInputs();
        });
    });

    // Activity length triggers recalculation
    document.querySelectorAll(".activity-length").forEach(input => {
        input.addEventListener("input", async e => {
            const i = parseInt(e.target.dataset.dayIndex);
            const j = parseInt(e.target.dataset.activityIndex);
            const value = parseInt(e.target.value) || 0;
            await updateActivityField(tripData, i, j, "length", value);
            renderTrip(tripData, apiKey); // Recalculate times
            hydrateClassicAutocompleteInputs();
        });
    });

    // Delete activity
    document.querySelectorAll(".delete-activity-button").forEach(btn =>
        btn.addEventListener("click", async e => {
            const i = parseInt(e.target.dataset.dayIndex);
            const j = parseInt(e.target.dataset.activityIndex);
            await handleDeleteActivity(tripData, i, j);
        })
    );

    // Delete day
    document.querySelectorAll(".delete-day-button").forEach(btn =>
        btn.addEventListener("click", async e => {
            const i = parseInt(e.target.dataset.dayIndex);
            await handleDeleteDay(tripData, i);
        })
    );

    // Add activity
    document.querySelectorAll(".add-activity-button").forEach(btn =>
        btn.addEventListener("click", async e => {
            const i = parseInt(e.target.dataset.dayIndex);
            await handleAddActivity(tripData, i);
        })
    );
}
