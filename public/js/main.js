import {
    loadTripSelector,
    handleTripSelection,
    handleAddDay,
    handleAddActivity,
    hydrateClassicAutocompleteInputs,
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

    function updateAddDayButton(state) {
        addDayButton.disabled = !state;
    }

    let apiKey = "";

    async function loadGoogleMapsAPI() {
        try {
            const response = await fetch('/config');
            const config = await response.json();
            apiKey = config.googleMapsApiKey;

            if (!apiKey) {
                console.error("Google Maps API Key is missing!");
                return;
            }

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);

            script.onload = async () => {
                console.log("✅ Google Maps API loaded");
                setupAutocomplete();
                hydrateClassicAutocompleteInputs();
            };
        } catch (error) {
            console.error("Error loading Google Maps API:", error);
        }
    }

    await loadGoogleMapsAPI();

    tripSelector.addEventListener("change", async (e) => {
        const selectedTrip = e.target.value;

        if (selectedTrip) {
            newTripFields.classList.remove("d-none");

            let tripData = await fetchTripData(selectedTrip);

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
            updateAddDayButton(true);
            renderTrip(tripData, apiKey);
            hydrateClassicAutocompleteInputs();
        } else {
            newTripFields.classList.add("d-none");
            tripNameInput.value = "";
            tripStartDateInput.value = "";
            updateAddDayButton(false);
        }
    });

    tripNameInput.addEventListener("input", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        tripData.tripName = tripNameInput.value;
        await saveTripData(tripData);
    });

    tripStartDateInput.addEventListener("input", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        tripData.startDate = tripStartDateInput.value;
        await saveTripData(tripData);
        renderTrip(tripData, apiKey);
        hydrateClassicAutocompleteInputs();
    });

    addDayButton.addEventListener("click", async () => {
        const selectedTrip = tripSelector.value;
        if (!selectedTrip) return;

        let tripData = await fetchTripData(selectedTrip);
        if (!tripData) return;

        await handleAddDay(tripData);
    });

    // Autocomplete listener for gmpx-place-autocomplete
    function setupAutocomplete() {
        // Activity location
        document.querySelectorAll('gmpx-place-autocomplete[data-activity-index]').forEach(wrapper => {
            wrapper.addEventListener('gmpx-placeautocomplete-placechange', (e) => {
                const place = e.detail;
                const input = wrapper.querySelector('input');
                if (place?.name && input) {
                    input.value = place.name;
                    input.dispatchEvent(new Event('blur'));
                }
            });
        });

        // Day location
        document.querySelectorAll('gmpx-place-autocomplete[data-field="location"]:not([data-activity-index])')
            .forEach(wrapper => {
                wrapper.addEventListener('gmpx-placeautocomplete-placechange', (e) => {
                    const place = e.detail;
                    const input = wrapper.querySelector('input');
                    if (place?.formatted_address || place?.name) {
                        input.value = place.formatted_address || place.name;
                        input.dispatchEvent(new Event('blur'));
                    }
                });
            });

        // Hotel autocomplete
        document.querySelectorAll('gmpx-place-autocomplete[data-field="lodging.name"]').forEach(wrapper => {
            wrapper.addEventListener('gmpx-placeautocomplete-placechange', (e) => {
                const place = e.detail;
                const dayIndex = wrapper.dataset.dayIndex;
                const input = wrapper.querySelector('input');

                const addressInput = document.querySelector(`input[data-field="lodging.address"][data-day-index="${dayIndex}"]`);
                const phoneInput = document.querySelector(`input[data-field="lodging.phone"][data-day-index="${dayIndex}"]`);

                if (place?.name && input) {
                    input.value = place.name;
                    input.dispatchEvent(new Event('blur'));
                }

                if (place?.formatted_address && addressInput) {
                    addressInput.value = place.formatted_address;
                    addressInput.dispatchEvent(new Event('blur'));
                }

                if (place?.formatted_phone_number && phoneInput) {
                    phoneInput.value = place.formatted_phone_number;
                    phoneInput.dispatchEvent(new Event('blur'));
                }
            });
        });
    }
});
