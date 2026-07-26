/**
 * Location Search Controller
 *
 * Handles city search, results rendering, geolocation, and location selection.
 */

import { setInputValue } from "../utils/dom-utils.js";
import {
  applyFilterTokens,
  CURRENT_LOCATION_LABEL,
  formatFilterTokensForHint,
  formatSelectedLocation,
  formatSuggestionLocation,
  isCurrentLocation,
  isNameMatch,
  normalizeCountryCode,
  parseQuery,
  sortByDistance,
} from "../utils/location-utils.js";
import {
  getSuggestionResults,
  setSuggestionResults,
  getRawResults,
  setRawResults,
  setActiveIndex,
  getDebounceId,
  setDebounceId,
  getFetchController,
  setFetchController,
  getPreferLocalResults,
  togglePreferLocalResults,
  getLastNameQuery,
  setLastNameQuery,
  isLocationBiasRequested,
  setLocationBiasRequested,
  isLocationBiasLoading,
  setLocationBiasLoading,
  getUserCoords,
  setUserCoords,
  getLastFilterTokens,
  setLastFilterTokens,
  getLastFilterTokensRaw,
  setLastFilterTokensRaw,
  getRecentLocations,
  setRecentLocations,
  setActiveLocation,
  clearReverseGeocodeCache,
  getMilestoneScanResults,
  setMilestoneScanResults,
  isMilestoneScanLoading,
  setMilestoneScanLoading,
  setMilestoneScanAbortController,
  cancelMilestoneScan,
} from "../state/app-state.js";
import {
  loadRecentLocations,
  saveRecentLocations,
  loadStoredLocation,
  saveStoredLocation,
} from "../services/storage-service.js";
import {
  searchCities,
  fetchDefaultLocationData,
  DEFAULT_LOCATION,
} from "../services/geocoding-service.js";
import { fetchReverseGeocodeLocation } from "../services/reverse-geocode-service.js";
import { scanCitiesForMilestones } from "../services/milestone-scanner-service.js";

// Constants
const MAX_RESULTS = 8;
const MAX_RECENTS = 5;
const CAN_USE_GEOLOCATION = "geolocation" in navigator;
// Callback for when location changes require daylight recalculation
let onLocationChange = null;

// DOM elements (set during initialization)
let dom = {};
let languageCode = "en";
let regionCode = "";
let fallbackTimeZone = "UTC";
let getActiveDateParts = null;
let locationOperationGeneration = 0;

const beginLocationOperation = () => {
  locationOperationGeneration += 1;
  if (isLocationBiasRequested() || isLocationBiasLoading()) {
    setLocationBiasRequested(false);
    setLocationBiasLoading(false);
    updateGeolocateButton();
  }
  return locationOperationGeneration;
};

const isCurrentLocationOperation = (operationToken) =>
  operationToken === locationOperationGeneration;

/**
 * Initialize the location controller with DOM elements and config
 * @param {Object} domElements - DOM elements object
 * @param {Object} config - Configuration object with languageCode, regionCode, fallbackTimeZone
 */
export const initLocationController = (domElements, config) => {
  dom = domElements;
  languageCode = config.languageCode || "en";
  regionCode = config.regionCode || "";
  fallbackTimeZone = config.fallbackTimeZone || "UTC";
  getActiveDateParts = config.getActiveDateParts || null;
};

/**
 * Register a callback to be called when location changes
 * @param {Function} callback - Function to call with the new location
 */
export const setLocationChangeCallback = (callback) => {
  onLocationChange = callback;
};

/**
 * Update the visibility of the clear button
 */
export const updateClearButton = () => {
  const { cityInput, clearButton } = dom;
  if (!cityInput || !clearButton) return;
  const hasValue = cityInput.value.trim().length > 0;
  clearButton.classList.toggle("is-visible", hasValue);
};

/**
 * Update the state of the geolocation button
 */
export const updateGeolocateButton = () => {
  const { geolocateButton } = dom;
  if (!geolocateButton) return;
  if (!CAN_USE_GEOLOCATION) {
    geolocateButton.disabled = true;
    geolocateButton.title = "Location unavailable";
    return;
  }
  geolocateButton.disabled = isLocationBiasLoading();
  geolocateButton.title = isLocationBiasLoading() ? "Locating..." : "Use my location";
};

/**
 * Update recent locations in state and storage
 */
const updateRecentLocations = (item) => {
  const recentLocations = getRecentLocations();
  const updated = [
    item,
    ...recentLocations.filter(
      (entry) =>
        entry.name !== item.name ||
        entry.admin1 !== item.admin1 ||
        entry.country_code !== item.country_code
    ),
  ].slice(0, MAX_RECENTS);
  setRecentLocations(updated);
  saveRecentLocations(updated);
};

/**
 * Set status messages in the results panel
 */
const setStatusMessages = (messages) => {
  const { resultsMeta, resultsPanel } = dom;
  if (!resultsMeta) return;
  resultsMeta.replaceChildren();
  messages.forEach((message) => {
    const status = document.createElement("div");
    status.className = `location-status${message.type ? ` is-${message.type}` : ""}`;
    status.textContent = message.text;
    resultsMeta.appendChild(status);
  });
  if (resultsPanel?.classList.contains("is-open")) {
    updateResultsMaxHeight();
  }
};

/**
 * Render action buttons in the results panel
 */
const renderActions = (actions) => {
  const { resultsActions, resultsPanel } = dom;
  if (!resultsActions) return;
  resultsActions.replaceChildren();
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `location-action${action.variant ? ` ${action.variant}` : ""}`;
    button.dataset.action = action.action;
    button.textContent = action.label;
    if (action.disabled) button.disabled = true;
    resultsActions.appendChild(button);
  });
  if (resultsPanel?.classList.contains("is-open")) {
    updateResultsMaxHeight();
  }
};

/**
 * Open the results panel
 */
const openResultsPanel = () => {
  const { resultsPanel, cityInput } = dom;
  if (!resultsPanel || !cityInput) return;
  resultsPanel.classList.add("is-open");
  cityInput.setAttribute("aria-expanded", "true");
  updateResultsMaxHeight();
};

/**
 * Get action items based on current state
 */
const getActionItems = ({ toggleLabel, includeRetry } = {}) => {
  const actions = [];
  if (toggleLabel) {
    actions.push({ action: "toggle-preference", label: toggleLabel });
  }
  if (includeRetry) {
    actions.push({ action: "retry", label: "Retry search", variant: "is-secondary" });
  }
  return actions;
};

/**
 * Group results into exact and nearby matches
 */
const groupResults = (results, nameQuery) => {
  const exactMatches = [];
  const nearbyMatches = [];
  results.forEach((item) => {
    if (isNameMatch(item, nameQuery)) {
      exactMatches.push(item);
    } else {
      nearbyMatches.push(item);
    }
  });
  const groups = [];
  if (exactMatches.length) {
    groups.push({
      label: nearbyMatches.length ? "Matches" : null,
      items: exactMatches,
    });
  }
  if (nearbyMatches.length) {
    groups.push({
      label: exactMatches.length ? "Nearby" : null,
      items: nearbyMatches,
    });
  }
  return groups;
};

/**
 * Render a group of results
 */
const renderGroup = (group) => {
  const { resultsList } = dom;
  if (!resultsList) return;
  const wrapper = document.createElement("div");
  wrapper.className = "location-group";
  wrapper.role = group.label ? "group" : "presentation";
  if (group.label) {
    wrapper.setAttribute("aria-label", group.label);
    const label = document.createElement("div");
    label.className = "location-group-label";
    label.textContent = group.label;
    label.setAttribute("aria-hidden", "true");
    wrapper.appendChild(label);
  }
  group.items.forEach((item) => {
    const currentResults = getSuggestionResults();
    const index = currentResults.length;
    setSuggestionResults([...currentResults, item]);
    const option = document.createElement("div");
    option.id = `location-option-${index}`;
    option.className = "location-option";
    option.role = "option";
    option.tabIndex = -1;
    option.dataset.index = String(index);
    option.textContent = formatSuggestionLocation(item);
    wrapper.appendChild(option);
  });
  resultsList.appendChild(wrapper);
};

/**
 * Show loading state in the results panel
 */
const showLoadingState = () => {
  const { resultsList, cityInput } = dom;
  setSuggestionResults([]);
  setActiveIndex(-1);
  if (!resultsList || !cityInput) return;
  resultsList.replaceChildren();
  cityInput.removeAttribute("aria-activedescendant");
  setStatusMessages([{ text: "Searching for cities...", type: "hint" }]);
  renderActions(getActionItems());
  openResultsPanel();
};

/**
 * Show error state in the results panel
 */
const showErrorState = () => {
  const { resultsList, cityInput } = dom;
  setSuggestionResults([]);
  setActiveIndex(-1);
  if (!resultsList || !cityInput) return;
  resultsList.replaceChildren();
  cityInput.removeAttribute("aria-activedescendant");
  setStatusMessages([
    {
      text: "Could not fetch city suggestions. Check your connection and try again.",
      type: "error",
    },
  ]);
  renderActions(getActionItems({ includeRetry: true }));
  openResultsPanel();
};

/**
 * Clear results and close the panel
 */
export const clearResults = () => {
  cancelMilestoneScan();
  const debounceId = getDebounceId();
  if (debounceId) {
    clearTimeout(debounceId);
    setDebounceId(null);
  }
  const fetchController = getFetchController();
  if (fetchController) {
    fetchController.abort();
    setFetchController(null);
  }
  setSuggestionResults([]);
  setRawResults([]);
  setActiveIndex(-1);
  const { resultsList, resultsMeta, resultsActions, resultsPanel, cityInput } = dom;
  if (!resultsList || !resultsMeta || !resultsActions || !resultsPanel || !cityInput) return;
  resultsList.replaceChildren();
  resultsMeta.replaceChildren();
  resultsActions.replaceChildren();
  resultsPanel.classList.remove("is-open");
  cityInput.setAttribute("aria-expanded", "false");
  cityInput.removeAttribute("aria-activedescendant");
  resultsList.style.maxHeight = "";
};

/**
 * Update the max height of the results list based on viewport
 */
export const updateResultsMaxHeight = () => {
  const { resultsPanel, cityInput, resultsList, resultsMeta, resultsActions, milestone } = dom;
  if (!resultsPanel || !cityInput || !resultsList) return;
  if (!resultsPanel.classList.contains("is-open")) return;
  const locationRect = cityInput.getBoundingClientRect();
  const milestoneRect = milestone?.getBoundingClientRect();
  const spacing = 12;
  const available =
    milestoneRect && milestoneRect.top > locationRect.bottom + spacing
      ? milestoneRect.top - locationRect.bottom - spacing
      : window.innerHeight - locationRect.bottom - spacing;
  const chromeHeight = (resultsMeta?.offsetHeight || 0) + (resultsActions?.offsetHeight || 0) + 24;
  const maxHeight = Math.max(0, Math.min(260, available - chromeHeight));
  resultsList.style.maxHeight = `${maxHeight}px`;
};

/**
 * Render results with groups and options
 */
const renderResults = (groups, options = {}) => {
  const { resultsList, cityInput } = dom;
  if (!resultsList || !cityInput) return;
  resultsList.replaceChildren();
  setSuggestionResults([]);
  setActiveIndex(-1);

  const statusMessages = [...(options.statusMessages || [])];
  const hasItems = groups.some((group) => group.items.length);
  if (!hasItems && options.emptyMessage) {
    statusMessages.push({ text: options.emptyMessage, type: "hint" });
  }
  setStatusMessages(statusMessages);
  renderActions(options.actions || []);

  if (hasItems) {
    groups.forEach(renderGroup);
  }

  openResultsPanel();

  if (hasItems) {
    updateActiveOption(0);
  } else {
    cityInput.removeAttribute("aria-activedescendant");
  }
};

/**
 * Build and render filtered results
 */
export const buildResults = (
  results,
  filterTokens = getLastFilterTokens(),
  rawTokens = getLastFilterTokensRaw()
) => {
  setRawResults(results);
  const filteredResults = applyFilterTokens(results, filterTokens);
  const effectiveResults = filteredResults.length ? filteredResults : results;
  const localResults = regionCode
    ? effectiveResults.filter((item) => normalizeCountryCode(item) === regionCode)
    : [];
  const otherResults = regionCode
    ? effectiveResults.filter((item) => normalizeCountryCode(item) !== regionCode)
    : effectiveResults;
  const sortedLocal = sortByDistance(localResults, getUserCoords());
  const sortedAll = sortByDistance(effectiveResults, getUserCoords());
  const filterHint =
    rawTokens.length && !filteredResults.length
      ? `No matches for "${formatFilterTokensForHint(rawTokens)}". Showing broader results.`
      : null;
  const localityLabel = getUserCoords() ? "nearby" : "local";
  let displayResults = sortedAll;
  let toggleLabel = null;
  const statusMessages = [];

  if (getPreferLocalResults() && sortedLocal.length) {
    displayResults = sortedLocal;
    toggleLabel = otherResults.length ? "Show worldwide results" : null;
  } else if (getPreferLocalResults() && !sortedLocal.length && regionCode) {
    displayResults = sortedAll;
    statusMessages.push({
      text: `No ${localityLabel} matches. Showing worldwide results.`,
      type: "hint",
    });
  } else {
    displayResults = sortedAll;
    if (sortedLocal.length && otherResults.length) {
      toggleLabel = getUserCoords() ? "Prefer nearby results" : "Prefer local results";
      statusMessages.push({ text: "Showing worldwide results.", type: "hint" });
    }
  }

  if (filterHint) {
    statusMessages.unshift({ text: filterHint, type: "hint" });
  }

  const groups = groupResults(displayResults.slice(0, MAX_RESULTS), getLastNameQuery());
  renderResults(groups, {
    statusMessages,
    actions: getActionItems({ toggleLabel }),
    emptyMessage: "No matches yet.",
  });
};

/**
 * Show recent locations in the results panel
 */
export const showRecentResults = () => {
  const recentLocations = getRecentLocations();
  if (!recentLocations.length) {
    clearResults();
    return;
  }
  const statusMessages = [{ text: "Recent locations.", type: "hint" }];
  const groups = [{ label: "Recent", items: recentLocations }];

  const scanResults = getMilestoneScanResults();
  if (scanResults && scanResults.length > 0) {
    groups.push({
      label: "Cities with Milestones",
      items: scanResults.map((r) => r.city),
    });
  } else if (scanResults !== null && scanResults.length === 0) {
    statusMessages.push({ text: "No cities found with milestones today.", type: "hint" });
  }

  const loading = isMilestoneScanLoading();
  const actions = loading
    ? [{ action: "find-milestone-cities", label: "Scanning cities\u2026", disabled: true }]
    : [
        ...getActionItems(),
        { action: "find-milestone-cities", label: "Find cities with milestones" },
      ];

  renderResults(groups, {
    statusMessages,
    actions,
    emptyMessage: "No recent locations yet.",
  });
};

/**
 * Select a location result
 */
export const selectResult = (
  item,
  { persist = true, updateRecents = true, operationToken = null } = {}
) => {
  const activeOperationToken = operationToken ?? beginLocationOperation();
  if (!isCurrentLocationOperation(activeOperationToken)) {
    return false;
  }
  clearReverseGeocodeCache();
  const label = formatSelectedLocation(item);
  setInputValue(dom.cityInput, label);
  if (updateRecents) {
    updateRecentLocations(item);
  }
  if (persist) {
    saveStoredLocation(item);
  }
  updateClearButton();
  clearResults();
  setActiveLocation(item);
  // eslint-disable-next-line no-console
  console.log(`Selected city: ${label}`, {
    latitude: item.latitude,
    longitude: item.longitude,
  });
  if (onLocationChange) {
    onLocationChange(item);
  }
  if (isCurrentLocation(item) && !item.reverseGeocodeFailed) {
    void resolveCurrentLocationName(item, activeOperationToken);
  }
  return true;
};

/**
 * Update the active (keyboard-focused) option
 */
export const updateActiveOption = (nextIndex) => {
  const { resultsList, cityInput } = dom;
  if (!resultsList || !cityInput) return;
  const options = resultsList.querySelectorAll(".location-option");
  if (!options.length) {
    setActiveIndex(-1);
    cityInput.removeAttribute("aria-activedescendant");
    return;
  }
  const safeIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
  setActiveIndex(safeIndex);
  options.forEach((option, index) => {
    const isActive = index === safeIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");
    option.tabIndex = isActive ? 0 : -1;
    if (isActive) {
      cityInput.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }
  });
};

/**
 * Build a current location object from coordinates
 */
const buildCurrentLocation = (coords, { reverseGeocodeFailed = false } = {}) => ({
  name: CURRENT_LOCATION_LABEL,
  admin1: "",
  admin2: "",
  country: "",
  country_code: "",
  latitude: coords.lat,
  longitude: coords.lon,
  elevation: 0,
  timezone: fallbackTimeZone,
  isCurrent: true,
  reverseGeocodeFailed,
});

/**
 * Select location from coordinates (with reverse geocoding)
 */
const selectLocationFromCoords = async (coords, operationToken) => {
  const currentLocation = buildCurrentLocation(coords);
  const resolved = await fetchReverseGeocodeLocation(currentLocation, languageCode);
  if (!isCurrentLocationOperation(operationToken)) {
    return;
  }
  if (resolved) {
    selectResult(resolved, { operationToken });
    return;
  }
  selectResult(
    { ...currentLocation, reverseGeocodeFailed: true },
    {
      operationToken,
    }
  );
};

/**
 * Request browser geolocation
 */
export const requestLocationBias = ({ onError, operationToken = null } = {}) => {
  if (isLocationBiasRequested() || !("geolocation" in navigator)) return;
  const activeOperationToken = operationToken ?? beginLocationOperation();
  if (!isCurrentLocationOperation(activeOperationToken)) return;
  setLocationBiasRequested(true);
  setLocationBiasLoading(true);
  updateGeolocateButton();
  renderActions(getActionItems());
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      if (!isCurrentLocationOperation(activeOperationToken)) {
        return;
      }
      setUserCoords(coords);
      try {
        await selectLocationFromCoords(coords, activeOperationToken);
      } finally {
        if (isCurrentLocationOperation(activeOperationToken)) {
          setLocationBiasLoading(false);
          setLocationBiasRequested(false);
          updateGeolocateButton();
        }
      }
    },
    (error) => {
      if (!isCurrentLocationOperation(activeOperationToken)) {
        return;
      }
      setLocationBiasLoading(false);
      setLocationBiasRequested(false);
      updateGeolocateButton();
      renderActions(getActionItems());
      if (typeof onError === "function") {
        onError(error, activeOperationToken);
      }
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
};

/**
 * Resolve a "Current Location" placeholder to actual location name
 */
const resolveCurrentLocationName = async (location, operationToken) => {
  if (!isCurrentLocation(location) || location?.reverseGeocodeFailed) return;
  const resolved = await fetchReverseGeocodeLocation(location, languageCode);
  if (resolved && isCurrentLocationOperation(operationToken)) {
    selectResult(resolved, {
      persist: true,
      updateRecents: false,
      operationToken,
    });
  }
};

/**
 * Fetch city suggestions from the API
 */
export const fetchSuggestions = async (nameQuery, filterTokens, rawTokens) => {
  const currentController = getFetchController();
  if (currentController) {
    currentController.abort();
  }
  const controller = new AbortController();
  setFetchController(controller);
  showLoadingState();
  try {
    const results = await searchCities(nameQuery, languageCode, controller.signal);
    buildResults(results, filterTokens, rawTokens);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("City lookup failed:", error);
    showErrorState();
  }
};

/**
 * Fetch and select the default location
 */
const fetchDefaultLocation = async (operationToken) => {
  try {
    const match = await fetchDefaultLocationData(languageCode);
    if (!isCurrentLocationOperation(operationToken)) {
      return;
    }
    if (match) {
      selectResult(match, {
        persist: false,
        updateRecents: false,
        operationToken,
      });
      return;
    }
    selectResult(DEFAULT_LOCATION, {
      persist: false,
      updateRecents: false,
      operationToken,
    });
  } catch (error) {
    if (!isCurrentLocationOperation(operationToken)) {
      return;
    }
    console.warn("Default location lookup failed:", error);
    selectResult(DEFAULT_LOCATION, {
      persist: false,
      updateRecents: false,
      operationToken,
    });
  }
};

/**
 * Initialize location from storage or geolocation
 */
export const initializeLocation = () => {
  // Load recent locations from storage
  setRecentLocations(loadRecentLocations());

  const storedLocation = loadStoredLocation();
  if (storedLocation) {
    if (isCurrentLocation(storedLocation)) {
      setUserCoords({
        lat: storedLocation.latitude,
        lon: storedLocation.longitude,
      });
    }
    selectResult(storedLocation, { persist: false, updateRecents: false });
  }

  const initializationToken = storedLocation ? null : beginLocationOperation();

  if (!CAN_USE_GEOLOCATION || !navigator.permissions?.query) {
    if (!storedLocation) {
      fetchDefaultLocation(initializationToken);
    }
    return;
  }

  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (!isCurrentLocationOperation(initializationToken)) {
        return;
      }
      if (status.state === "granted") {
        if (!storedLocation) {
          requestLocationBias({
            operationToken: initializationToken,
            onError: (_error, operationToken) => fetchDefaultLocation(operationToken),
          });
        }
      } else if (!storedLocation) {
        fetchDefaultLocation(initializationToken);
      }
    })
    .catch((error) => {
      if (!isCurrentLocationOperation(initializationToken)) {
        return;
      }
      console.warn("Unable to check geolocation permission:", error);
      if (!storedLocation) {
        fetchDefaultLocation(initializationToken);
      }
    });
};

/**
 * Handle input in the city search field
 */
export const handleInput = () => {
  const { cityInput } = dom;
  if (!cityInput) return;
  const query = cityInput.value.trim();
  const { nameQuery, filterTokens, rawFilterTokens } = parseQuery(query);
  setLastNameQuery(nameQuery);
  setLastFilterTokens(filterTokens);
  setLastFilterTokensRaw(rawFilterTokens);
  updateClearButton();
  if (nameQuery.length < 2) {
    const debounceId = getDebounceId();
    if (debounceId) {
      clearTimeout(debounceId);
      setDebounceId(null);
    }
    const fetchController = getFetchController();
    if (fetchController) {
      fetchController.abort();
      setFetchController(null);
    }
    if (getRecentLocations().length) {
      showRecentResults();
    } else {
      clearResults();
    }
    return;
  }
  const existingDebounceId = getDebounceId();
  if (existingDebounceId) {
    clearTimeout(existingDebounceId);
  }
  const newDebounceId = window.setTimeout(() => {
    fetchSuggestions(nameQuery, filterTokens, rawFilterTokens);
  }, 250);
  setDebounceId(newDebounceId);
};

/**
 * Handle toggle preference action
 */
export const handleTogglePreference = () => {
  togglePreferLocalResults();
  const rawResults = getRawResults();
  if (rawResults.length) {
    buildResults(rawResults, getLastFilterTokens(), getLastFilterTokensRaw());
  }
};

/**
 * Handle retry action
 */
export const handleRetry = () => {
  const nameQuery = getLastNameQuery();
  if (nameQuery.length >= 2) {
    fetchSuggestions(nameQuery, getLastFilterTokens(), getLastFilterTokensRaw());
  } else {
    clearResults();
  }
};

/**
 * Scan major cities for milestones occurring today
 */
export const handleFindMilestoneCities = async () => {
  cancelMilestoneScan();

  const controller = new AbortController();
  setMilestoneScanAbortController(controller);
  setMilestoneScanLoading(true);
  showRecentResults();

  try {
    const results = await scanCitiesForMilestones(getActiveDateParts, controller.signal);
    if (controller.signal.aborted) return;
    setMilestoneScanResults(results);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Milestone scan failed:", error);
    setMilestoneScanResults([]);
  } finally {
    setMilestoneScanLoading(false);
  }

  showRecentResults();
};
