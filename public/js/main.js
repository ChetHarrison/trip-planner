import {
    loadTripSelector,
    handleTripSelection,
    handleAddDay,
    handleAddActivity,
    renderTrip,
    fetchTripData,
    saveTripData,
    initDragAndDrop,
    handleDeleteDay,
    handleDeleteActivity
} from './tripPlanner.js';

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded, initializing trip planner...");

    await loadTripSelector();

    const tripSelector = document.getElementById("trip-selector");
    const addDayButton = document.getElementById("add-day-button");
    const newTripFields = document.getElementById("new-trip-fields");
    const tripNameInput = document.getElementById("trip-name");
    const tripStartDateInput = document.getElementById("trip-start-date");

    // ✅ Enable/Disable Add Day button based on trip selection
    function updateAddDayButton(state) {
        addDayButton.disabled = !state;
    }

    // ✅ Handle trip selection and pass trip data explicitly
    tripSelector.addEventListener("change", async (e) => {
        const selectedTrip = e.target.value;

        if (selectedTrip) {
            newTripFields.classList.remove("d-none");

            let tripData = await fetchTripData(selectedTrip);

            // ✅ If no trip exists, create a new one and save it
            if (!tripData) {
                tripData = {
                    tripName: `New Trip ${new Date().toISOString().split("T")[0]}`,
                    startDate: new Date().toISOString().split("T")[0],
                    trip: []
                };
                await saveTripData(tripData);
                await loadTripSelector();
            }

            tripNameInput.value = tripData.tripName;
            tripStartDateInput.value = tripData.startDate;
            updateAddDayButton(true); // ✅ Enable Add Day button
            renderTrip(tripData); // ✅ Pass trip data explicitly
        } else {
            newTripFields.classList.add("d-none");
            tripNameInput.value = "";
            tripStartDateInput.value = "";
            updateAddDayButton(false);
        }
    });

    // ✅ Save modified trip name directly to JSON
    tripNameInput.addEventListener("input", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        tripData.tripName = tripNameInput.value;
        await saveTripData(tripData);
    });

    // ✅ Save modified start date directly to JSON
    tripStartDateInput.addEventListener("input", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        tripData.startDate = tripStartDateInput.value;
        await saveTripData(tripData);

        // 🔥 Force re-render to reflect new dates
        renderTrip(tripData);
    });

    // ✅ Load Google Maps API dynamically from backend configuration
    async function loadGoogleMapsAPI() {
        try {
            const response = await fetch('/config'); // Fetch API key securely
            const config = await response.json();
            const apiKey = config.googleMapsApiKey;

            if (!apiKey) {
                console.error("Google Maps API Key is missing!");
                return;
            }

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);

            script.onload = () => {
                console.log("Google Maps API loaded successfully.");
            };
        } catch (error) {
            console.error("Error loading Google Maps API:", error);
        }
    }

    await loadGoogleMapsAPI();

    // ✅ Handle adding a new day (pass trip data explicitly)
    addDayButton.addEventListener("click", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        await handleAddDay(tripData);
    });
});
