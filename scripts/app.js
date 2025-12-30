/**
 * Sunshine Optimist - Main Application Entry Point
 *
 * This module initializes the application, wires up event handlers,
 * and coordinates between UI modules, services, and state management.
 */

import { getOptimisticMessageOptions } from "./messages.js";
import {
  DAYLIGHT_GAIN_MILESTONES,
  SUNSET_THRESHOLD_MILESTONES,
} from "./milestones.js";
import { createAstronomyContext } from "./astronomy-utils.js";
import {
  addDaysToDateParts,
  addMonthsToDateParts,
  compareDateParts,
  createDateFormatter,
  formatDateInputValue,
  getDaysBetweenDateParts,
  getDaysInMonth,
  getDaysInYear,
  getLocalDateParts,
  getLocalNoonDateFromParts,
  getMinutesSinceMidnight,
  parseDateInputValue,
} from "./date-utils.js";
import { getText, setInputValue, setText } from "./dom-utils.js";
import {
  applyFilterTokens,
  formatFilterTokensForHint,
  formatSelectedLocation,
  formatSuggestionLocation,
  isNameMatch,
  normalizeCountryCode,
  parseQuery,
  sortByDistance,
} from "./location-utils.js";
import { clampValue } from "./utils.js";

// State management
import {
  // Location state
  getSuggestionResults,
  setSuggestionResults,
  getRawResults,
  setRawResults,
  getActiveIndex,
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
  getActiveLocation,
  setActiveLocation,
  // Date state
  isUsingLiveDate,
  setUseLiveDate,
  getCustomDateParts,
  setCustomDateParts,
  getDateCommitTimeoutId,
  setDateCommitTimeoutId,
  getLastKeydownAt,
  setLastKeydownAt,
  // Milestone state
  getUpcomingMilestones,
  getMilestoneIndex,
  setMilestoneIndex,
  getMilestoneTimeZone,
  // Optimistic state
  getOptimisticOptions,
  getOptimisticIndex,
  // Debug state
  getOptimisticDebugState,
  updateDebugState,
  // Share state
  setShareSnapshot,
  isSharePrivacyEnabled,
  setSharePrivacyEnabled,
  // Reverse geocode
  clearReverseGeocodeCache,
} from "./state/app-state.js";

// Services
import {
  loadRecentLocations,
  saveRecentLocations,
  loadStoredLocation,
  saveStoredLocation,
  loadSharePrivacyPreference,
  saveSharePrivacyPreference,
} from "./services/storage-service.js";
import {
  searchCities,
  fetchDefaultLocationData,
  DEFAULT_LOCATION,
} from "./services/geocoding-service.js";
import { fetchReverseGeocodeLocation } from "./services/reverse-geocode-service.js";

// Formatters
import {
  formatDuration,
  formatDeltaStatement,
  formatComparisonTooltip,
  formatOptimisticLogHeadline,
  buildOptimisticLogLine,
} from "./formatters/formatters.js";

// UI modules
import { launchConfetti } from "./ui/confetti-ui.js";
import {
  updateDeltaTooltip,
  closeDeltaTooltips,
  initializeTooltipTarget,
  initializeGlobalTooltipHandlers,
} from "./ui/tooltip-ui.js";
import {
  startOptimisticRotation,
  stopOptimisticRotation,
  setOptimisticCopy,
  OPTIMISTIC_POLAR_COPY,
  OPTIMISTIC_FALLBACK_COPY,
} from "./ui/message-ui.js";
import {
  updateMilestoneCard,
  getMilestoneKey,
  getMilestoneTodayCopy,
  celebrateMilestone,
} from "./ui/milestone-ui.js";
import {
  openShareModal,
  closeShareModal,
  refreshSharePreview,
  copyShareText,
  openShareLink,
  flashActionLabel,
  updateShareSnapshot,
} from "./ui/share-modal-ui.js";

// ============================================================================
// Constants
// ============================================================================
const MAX_RESULTS = 8;
const MAX_RECENTS = 5;
const CAN_USE_GEOLOCATION = "geolocation" in navigator;
const CURRENT_LOCATION_LABEL = "Current Location";
const DATE_COMMIT_DELAY_MS = 300;
const DATE_KEYBOARD_GRACE_MS = 800;
const FALLBACK_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// Locale detection
const localeSource = navigator.languages?.[0] || navigator.language || "en";
const languageCode = localeSource.split("-")[0] || "en";
const regionCode = (localeSource.split("-")[1] || "").toUpperCase();

// Date formatters
const {
  formatLongDateFromParts,
  formatShortDateFromParts,
  formatTime,
  formatTimeFromMinutes,
} = createDateFormatter(localeSource);

// ============================================================================
// DOM Elements
// ============================================================================
const dom = {
  shareButton: document.getElementById("share"),
  shareModal: document.getElementById("share-modal"),
  shareModalClose: document.getElementById("share-modal-close"),
  sharePreview: document.getElementById("share-preview"),
  sharePrivacyToggle: document.getElementById("share-privacy-toggle"),
  shareActionButtons: document.querySelectorAll(
    ".share-icon-button[data-share], .share-copy-button[data-share]"
  ),
  headline: document.getElementById("headline"),
  lede: document.getElementById("lede"),
  cityInput: document.getElementById("city-input"),
  geolocateButton: document.getElementById("location-geolocate"),
  resultsPanel: document.getElementById("location-results"),
  resultsMeta: document.getElementById("location-results-meta"),
  resultsActions: document.getElementById("location-results-actions"),
  resultsList: document.getElementById("location-results-list"),
  clearButton: document.getElementById("location-clear"),
  milestone: document.querySelector(".milestone"),
  milestoneToggle: document.getElementById("milestone-toggle"),
  confettiRoot: document.getElementById("confetti"),
  sunsetTimeValue: document.getElementById("sunset-time"),
  sunsetEarliestDeltaValue: document.getElementById("sunset-earliest-delta"),
  sunsetComparisonDeltaValue: document.getElementById("sunset-month-delta"),
  daylightDurationValue: document.getElementById("daylight-duration"),
  daylightShortestDeltaValue: document.getElementById("daylight-shortest-delta"),
  daylightComparisonDeltaValue: document.getElementById("daylight-month-delta"),
  sunsetEarliestRow: document.getElementById("sunset-earliest-row"),
  sunsetComparisonRow: document.getElementById("sunset-month-row"),
  daylightShortestRow: document.getElementById("daylight-shortest-row"),
  daylightComparisonRow: document.getElementById("daylight-month-row"),
  sunsetEarliestReference: document.getElementById("sunset-earliest-reference"),
  sunsetComparisonReference: document.getElementById("sunset-comparison-reference"),
  daylightShortestReference: document.getElementById("daylight-shortest-reference"),
  daylightComparisonReference: document.getElementById("daylight-comparison-reference"),
  nextHeadline: document.getElementById("next-headline"),
  nextDate: document.getElementById("next-date"),
  nextAway: document.getElementById("next-away"),
  dateInput: document.getElementById("date-input"),
  dateReset: document.getElementById("date-reset"),
  datePicker: document.querySelector(".date-picker"),
};

// Destructure for convenience
const {
  shareButton,
  shareModal,
  shareModalClose,
  sharePreview,
  sharePrivacyToggle,
  shareActionButtons,
  headline,
  lede,
  cityInput,
  geolocateButton,
  resultsPanel,
  resultsMeta,
  resultsActions,
  resultsList,
  clearButton,
  milestone,
  milestoneToggle,
  confettiRoot,
  dateInput,
  dateReset,
  datePicker,
} = dom;

// ============================================================================
// Date Picker Functions
// ============================================================================
const getActiveDateParts = (timeZone) => {
  if (!isUsingLiveDate() && getCustomDateParts()) {
    return getCustomDateParts();
  }
  return getLocalDateParts(new Date(), timeZone);
};

const syncDatePicker = (timeZone) => {
  if (!dateInput) return;
  const parts = getActiveDateParts(timeZone);
  if (parts) {
    const nextValue = formatDateInputValue(parts);
    if (dateInput.value !== nextValue) {
      dateInput.value = nextValue;
    }
  }
  if (dateReset) {
    dateReset.disabled = isUsingLiveDate();
  }
  if (datePicker) {
    datePicker.classList.toggle("is-custom", !isUsingLiveDate());
  }
};

const clearDateCommitTimeout = () => {
  const timeoutId = getDateCommitTimeoutId();
  if (timeoutId) {
    clearTimeout(timeoutId);
    setDateCommitTimeoutId(null);
  }
};

const applyDateSelection = (nextParts) => {
  if (nextParts) {
    const currentCustom = getCustomDateParts();
    if (
      !isUsingLiveDate() &&
      currentCustom &&
      currentCustom.year === nextParts.year &&
      currentCustom.month === nextParts.month &&
      currentCustom.day === nextParts.day
    ) {
      return false;
    }
    setCustomDateParts(nextParts);
    setUseLiveDate(false);
    return true;
  }
  if (isUsingLiveDate()) {
    return false;
  }
  setCustomDateParts(null);
  setUseLiveDate(true);
  return true;
};

const commitDateSelection = () => {
  if (!dateInput) return;
  clearDateCommitTimeout();
  const nextParts = parseDateInputValue(dateInput.value);
  const didChange = applyDateSelection(nextParts);
  const timeZone = getActiveLocation()?.timezone || FALLBACK_TIMEZONE;
  syncDatePicker(timeZone);
  if (getActiveLocation() && didChange) {
    updateDaylightForLocation(getActiveLocation());
  }
};

const scheduleDateCommit = () => {
  clearDateCommitTimeout();
  const timeoutId = window.setTimeout(() => {
    setDateCommitTimeoutId(null);
    commitDateSelection();
  }, DATE_COMMIT_DELAY_MS);
  setDateCommitTimeoutId(timeoutId);
};

const isRecentDateKeyboardInput = () =>
  Date.now() - getLastKeydownAt() < DATE_KEYBOARD_GRACE_MS;

// ============================================================================
// Logging Functions
// ============================================================================
const logOptimisticMessages = () => {
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  const location = getActiveLocation();
  const timeZone = location?.timezone || FALLBACK_TIMEZONE;
  const dateParts = getActiveDateParts(timeZone);
  const locationLabel = location ? formatSelectedLocation(location) : "";
  const dateLabel = dateParts ? formatLongDateFromParts(dateParts, timeZone) : "";
  const debugState = getOptimisticDebugState();
  const list = debugState.validOptions.length
    ? debugState.validOptions
    : debugState.displayedOptions;
  const header = `Optimistic messages for ${
    locationLabel || "Unknown location"
  } on ${dateLabel || "Unknown date"}:`;
  const lines = list.map(buildOptimisticLogLine);
  console.log([header, ...lines].join("\n"));
};

// ============================================================================
// Optimistic Message Functions
// ============================================================================
const updateOptimisticMessage = (data, month, hemisphere) => {
  updateDebugState({ data, month, hemisphere });

  if (
    data.sunset_today == null ||
    Number.isNaN(data.sunset_today) ||
    data.daylight_today == null ||
    Number.isNaN(data.daylight_today)
  ) {
    updateDebugState({
      validOptions: [],
      displayedOptions: [OPTIMISTIC_POLAR_COPY],
      reason: "polar",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_POLAR_COPY]);
    logOptimisticMessages();
    return;
  }

  const options = getOptimisticMessageOptions(data, month, hemisphere);
  updateDebugState({ validOptions: options });

  if (!options.length) {
    updateDebugState({
      displayedOptions: [OPTIMISTIC_FALLBACK_COPY],
      reason: "fallback",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_FALLBACK_COPY]);
    logOptimisticMessages();
    return;
  }

  updateDebugState({
    displayedOptions: options,
    reason: "ok",
  });
  startOptimisticRotation(headline, lede, options);
  logOptimisticMessages();
};

// ============================================================================
// Milestone Functions
// ============================================================================
const buildMilestone = ({ id, title, dateParts, todayHeadline, todayLede }) => {
  if (!dateParts) return null;
  return { id, title, dateParts, todayHeadline, todayLede };
};

const withMilestoneOffset = (milestoneItem, todayParts) => {
  if (!milestoneItem || !todayParts) return null;
  const offsetDays = getDaysBetweenDateParts(todayParts, milestoneItem.dateParts);
  if (!Number.isFinite(offsetDays)) return null;
  return { ...milestoneItem, offsetDays };
};

// ============================================================================
// Location Search Functions
// ============================================================================
const isCurrentLocation = (location) =>
  Boolean(location?.isCurrent) ||
  (location?.name || "").toLowerCase() === CURRENT_LOCATION_LABEL.toLowerCase();

const updateClearButton = () => {
  if (!cityInput || !clearButton) return;
  const hasValue = cityInput.value.trim().length > 0;
  clearButton.classList.toggle("is-visible", hasValue);
};

const updateGeolocateButton = () => {
  if (!geolocateButton) return;
  if (!CAN_USE_GEOLOCATION) {
    geolocateButton.disabled = true;
    geolocateButton.title = "Location unavailable";
    return;
  }
  geolocateButton.disabled = isLocationBiasLoading();
  geolocateButton.title = isLocationBiasLoading() ? "Locating..." : "Use my location";
};

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

const setStatusMessages = (messages) => {
  if (!resultsMeta) return;
  resultsMeta.innerHTML = "";
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

const renderActions = (actions) => {
  if (!resultsActions) return;
  resultsActions.innerHTML = "";
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

const openResultsPanel = () => {
  if (!resultsPanel || !cityInput) return;
  resultsPanel.classList.add("is-open");
  cityInput.setAttribute("aria-expanded", "true");
  updateResultsMaxHeight();
};

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

const renderGroup = (group) => {
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

const showLoadingState = () => {
  setSuggestionResults([]);
  setActiveIndex(-1);
  if (!resultsList || !cityInput) return;
  resultsList.innerHTML = "";
  cityInput.removeAttribute("aria-activedescendant");
  setStatusMessages([{ text: "Searching for cities...", type: "hint" }]);
  renderActions(getActionItems());
  openResultsPanel();
};

const showErrorState = () => {
  setSuggestionResults([]);
  setActiveIndex(-1);
  if (!resultsList || !cityInput) return;
  resultsList.innerHTML = "";
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

const clearResults = () => {
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
  if (!resultsList || !resultsMeta || !resultsActions || !resultsPanel || !cityInput) return;
  resultsList.innerHTML = "";
  resultsMeta.innerHTML = "";
  resultsActions.innerHTML = "";
  resultsPanel.classList.remove("is-open");
  cityInput.setAttribute("aria-expanded", "false");
  cityInput.removeAttribute("aria-activedescendant");
  resultsList.style.maxHeight = "";
};

const updateResultsMaxHeight = () => {
  if (!resultsPanel || !cityInput || !resultsList) return;
  if (!resultsPanel.classList.contains("is-open")) return;
  const locationRect = cityInput.getBoundingClientRect();
  const milestoneRect = milestone?.getBoundingClientRect();
  const spacing = 12;
  const available =
    milestoneRect && milestoneRect.top > locationRect.bottom + spacing
      ? milestoneRect.top - locationRect.bottom - spacing
      : window.innerHeight - locationRect.bottom - spacing;
  const chromeHeight =
    (resultsMeta?.offsetHeight || 0) + (resultsActions?.offsetHeight || 0) + 24;
  const maxHeight = Math.max(0, Math.min(260, available - chromeHeight));
  resultsList.style.maxHeight = `${maxHeight}px`;
};

const renderResults = (groups, options = {}) => {
  if (!resultsList || !cityInput) return;
  resultsList.innerHTML = "";
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

const buildResults = (
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

const showRecentResults = () => {
  const recentLocations = getRecentLocations();
  if (!recentLocations.length) {
    clearResults();
    return;
  }
  const statusMessages = [{ text: "Recent locations.", type: "hint" }];
  const groups = [{ label: "Recent", items: recentLocations }];
  renderResults(groups, {
    statusMessages,
    actions: getActionItems(),
    emptyMessage: "No recent locations yet.",
  });
};

const selectResult = (item, { persist = true, updateRecents = true } = {}) => {
  clearReverseGeocodeCache();
  const label = formatSelectedLocation(item);
  setInputValue(cityInput, label);
  if (updateRecents) {
    updateRecentLocations(item);
  }
  if (persist) {
    saveStoredLocation(item);
  }
  updateClearButton();
  clearResults();
  setActiveLocation(item);
  console.log(`Selected city: ${label}`, {
    latitude: item.latitude,
    longitude: item.longitude,
  });
  updateDaylightForLocation(item);
  if (isCurrentLocation(item) && !item.reverseGeocodeFailed) {
    void resolveCurrentLocationName(item);
  }
};

const updateActiveOption = (nextIndex) => {
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

const buildCurrentLocation = (coords, { reverseGeocodeFailed = false } = {}) => ({
  name: CURRENT_LOCATION_LABEL,
  admin1: "",
  admin2: "",
  country: "",
  country_code: "",
  latitude: coords.lat,
  longitude: coords.lon,
  elevation: 0,
  timezone: FALLBACK_TIMEZONE,
  isCurrent: true,
  reverseGeocodeFailed,
});

const selectLocationFromCoords = async (coords) => {
  const currentLocation = buildCurrentLocation(coords);
  const resolved = await fetchReverseGeocodeLocation(currentLocation, languageCode);
  if (resolved) {
    selectResult(resolved);
    return;
  }
  selectResult({ ...currentLocation, reverseGeocodeFailed: true });
};

const requestLocationBias = ({ onError } = {}) => {
  if (isLocationBiasRequested() || !("geolocation" in navigator)) return;
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
      setUserCoords(coords);
      try {
        await selectLocationFromCoords(coords);
      } finally {
        setLocationBiasLoading(false);
        setLocationBiasRequested(false);
        updateGeolocateButton();
      }
    },
    (error) => {
      setLocationBiasLoading(false);
      setLocationBiasRequested(false);
      updateGeolocateButton();
      renderActions(getActionItems());
      if (typeof onError === "function") {
        onError(error);
      }
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
};

const resolveCurrentLocationName = async (location) => {
  if (!isCurrentLocation(location) || location?.reverseGeocodeFailed) return;
  const resolved = await fetchReverseGeocodeLocation(location, languageCode);
  if (resolved) {
    selectResult(resolved, { persist: true, updateRecents: false });
  }
};

const fetchSuggestions = async (nameQuery, filterTokens, rawTokens) => {
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

const fetchDefaultLocation = async () => {
  try {
    const match = await fetchDefaultLocationData(languageCode);
    if (match) {
      selectResult(match, { persist: false, updateRecents: false });
      return;
    }
    selectResult(DEFAULT_LOCATION, { persist: false, updateRecents: false });
  } catch (error) {
    console.warn("Default location lookup failed:", error);
    selectResult(DEFAULT_LOCATION, { persist: false, updateRecents: false });
  }
};

const initializeLocation = () => {
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

  if (!CAN_USE_GEOLOCATION || !navigator.permissions?.query) {
    if (!storedLocation) {
      fetchDefaultLocation();
    }
    return;
  }

  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (status.state === "granted") {
        if (!storedLocation) {
          requestLocationBias({ onError: fetchDefaultLocation });
        }
      } else if (!storedLocation) {
        fetchDefaultLocation();
      }
    })
    .catch((error) => {
      console.warn("Unable to check geolocation permission:", error);
      if (!storedLocation) {
        fetchDefaultLocation();
      }
    });
};

const handleInput = () => {
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

// ============================================================================
// Daylight Calculations
// ============================================================================
const updateDaylightForLocation = (location) => {
  if (!window.Astronomy || !location) return;

  const timeZone = location.timezone || FALLBACK_TIMEZONE;
  const hemisphere = location.latitude < 0 ? "south" : "north";
  const astronomy = createAstronomyContext(location, timeZone);
  const todayParts = getActiveDateParts(timeZone);
  syncDatePicker(timeZone);

  const weekParts = addDaysToDateParts(todayParts, -7);
  const monthParts = addMonthsToDateParts(todayParts, -1);
  const todayEvents = astronomy.getSunEvents(todayParts);
  const weekEvents = astronomy.getSunEvents(weekParts);
  const monthEvents = astronomy.getSunEvents(monthParts);

  // Update sunset time display
  setText(
    dom.sunsetTimeValue,
    todayEvents.sunset ? formatTime(todayEvents.sunset.date, timeZone) : "—"
  );

  // Calculate deltas
  const todaySunsetMinutes = todayEvents.sunset
    ? getMinutesSinceMidnight(todayEvents.sunset.date, timeZone)
    : null;
  const weekSunsetMinutes = weekEvents.sunset
    ? getMinutesSinceMidnight(weekEvents.sunset.date, timeZone)
    : null;
  const monthSunsetMinutes = monthEvents.sunset
    ? getMinutesSinceMidnight(monthEvents.sunset.date, timeZone)
    : null;
  const todayDaylight = astronomy.getDaylightMinutesForDateParts(todayParts);
  const weekDaylight = astronomy.getDaylightMinutesForDateParts(weekParts);
  const monthDaylight = astronomy.getDaylightMinutesForDateParts(monthParts);
  const referenceYear = todayParts.year;

  const {
    earliestSunsetMinutes,
    earliestSunsetDateParts,
    shortestDayMinutes,
    shortestDayDateParts,
    longestDayMinutes,
    longestDayDateParts,
    maxDailyGainDateParts,
    daysWithLessDaylight,
  } = astronomy.getYearlySunExtremes(todayParts.year, todayDaylight);

  const sunsetEarliestDelta =
    todaySunsetMinutes != null && earliestSunsetMinutes != null
      ? todaySunsetMinutes - earliestSunsetMinutes
      : null;
  const sunsetWeekDelta =
    todaySunsetMinutes != null && weekSunsetMinutes != null
      ? todaySunsetMinutes - weekSunsetMinutes
      : null;
  const sunsetMonthDelta =
    todaySunsetMinutes != null && monthSunsetMinutes != null
      ? todaySunsetMinutes - monthSunsetMinutes
      : null;
  const daylightShortestDelta =
    todayDaylight != null && shortestDayMinutes != null
      ? todayDaylight - shortestDayMinutes
      : null;
  const daylightWeekDelta =
    todayDaylight != null && weekDaylight != null
      ? todayDaylight - weekDaylight
      : null;
  const daylightMonthDelta =
    todayDaylight != null && monthDaylight != null
      ? todayDaylight - monthDaylight
      : null;

  const isNegativeDelta = (value) => Number.isFinite(value) && value < 0;
  const monthHasNegative =
    isNegativeDelta(sunsetMonthDelta) || isNegativeDelta(daylightMonthDelta);
  const weekHasNegative =
    isNegativeDelta(sunsetWeekDelta) || isNegativeDelta(daylightWeekDelta);
  const comparisonMode = monthHasNegative
    ? weekHasNegative
      ? "none"
      : "week"
    : "month";
  const showComparison = comparisonMode !== "none";
  const comparisonReference =
    comparisonMode === "week" ? "1 week ago" : "1 month ago";
  const sunsetComparisonDelta =
    comparisonMode === "week" ? sunsetWeekDelta : sunsetMonthDelta;
  const daylightComparisonDelta =
    comparisonMode === "week" ? daylightWeekDelta : daylightMonthDelta;

  // Update stats display
  const sunsetEarliestText = formatDeltaStatement(sunsetEarliestDelta, "later", "earlier");
  const daylightShortestText = formatDeltaStatement(daylightShortestDelta, "longer", "shorter");
  const sunsetComparisonText = showComparison
    ? formatDeltaStatement(sunsetComparisonDelta, "later", "earlier")
    : "";
  const daylightComparisonText = showComparison
    ? formatDeltaStatement(daylightComparisonDelta, "longer", "shorter")
    : "";

  setText(dom.sunsetEarliestDeltaValue, sunsetEarliestText);
  setText(dom.daylightDurationValue, todayDaylight == null ? "—" : formatDuration(todayDaylight));
  setText(dom.daylightShortestDeltaValue, daylightShortestText);

  if (dom.sunsetEarliestRow) {
    dom.sunsetEarliestRow.classList.toggle("is-hidden", !sunsetEarliestText);
  }
  if (dom.daylightShortestRow) {
    dom.daylightShortestRow.classList.toggle("is-hidden", !daylightShortestText);
  }

  const showSunsetComparison = Boolean(sunsetComparisonText);
  const showDaylightComparison = Boolean(daylightComparisonText);

  if (dom.sunsetComparisonRow) {
    dom.sunsetComparisonRow.classList.toggle("is-hidden", !showSunsetComparison);
  }
  if (dom.daylightComparisonRow) {
    dom.daylightComparisonRow.classList.toggle("is-hidden", !showDaylightComparison);
  }

  setText(dom.sunsetComparisonReference, showSunsetComparison ? comparisonReference : "");
  setText(dom.daylightComparisonReference, showDaylightComparison ? comparisonReference : "");
  setText(dom.sunsetComparisonDeltaValue, sunsetComparisonText);
  setText(dom.daylightComparisonDeltaValue, daylightComparisonText);

  // Update tooltips
  const sunsetEarliestTooltip =
    earliestSunsetMinutes != null && earliestSunsetDateParts
      ? formatComparisonTooltip(
          formatTimeFromMinutes(earliestSunsetMinutes, earliestSunsetDateParts, timeZone),
          earliestSunsetDateParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const sunsetWeekTooltip = weekEvents.sunset
    ? formatComparisonTooltip(
        formatTime(weekEvents.sunset.date, timeZone),
        weekParts,
        timeZone,
        referenceYear,
        formatShortDateFromParts
      )
    : "";
  const sunsetMonthTooltip = monthEvents.sunset
    ? formatComparisonTooltip(
        formatTime(monthEvents.sunset.date, timeZone),
        monthParts,
        timeZone,
        referenceYear,
        formatShortDateFromParts
      )
    : "";
  const sunsetComparisonTooltip =
    comparisonMode === "week" ? sunsetWeekTooltip : sunsetMonthTooltip;

  updateDeltaTooltip(dom.sunsetEarliestReference, sunsetEarliestText ? sunsetEarliestTooltip : "");
  updateDeltaTooltip(dom.sunsetComparisonReference, showSunsetComparison ? sunsetComparisonTooltip : "");

  const daylightShortestTooltip =
    shortestDayMinutes != null && shortestDayDateParts
      ? formatComparisonTooltip(
          formatDuration(shortestDayMinutes),
          shortestDayDateParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightWeekTooltip =
    weekDaylight != null
      ? formatComparisonTooltip(
          formatDuration(weekDaylight),
          weekParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightMonthTooltip =
    monthDaylight != null
      ? formatComparisonTooltip(
          formatDuration(monthDaylight),
          monthParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightComparisonTooltip =
    comparisonMode === "week" ? daylightWeekTooltip : daylightMonthTooltip;

  updateDeltaTooltip(dom.daylightShortestReference, daylightShortestText ? daylightShortestTooltip : "");
  updateDeltaTooltip(dom.daylightComparisonReference, showDaylightComparison ? daylightComparisonTooltip : "");

  // Build message data
  const startOfYearParts = { year: todayParts.year, month: 1, day: 1 };
  const sunsetStartOfYear = astronomy.getSunsetMinutesForDateParts(startOfYearParts);
  const twoMonthsParts = addMonthsToDateParts(todayParts, -2);
  const twoMonthsDaylight = astronomy.getDaylightMinutesForDateParts(twoMonthsParts);
  const endOfMonthParts = {
    year: todayParts.year,
    month: todayParts.month,
    day: getDaysInMonth(todayParts.year, todayParts.month),
  };
  const daylightAtEndOfMonth = astronomy.getDaylightMinutesForDateParts(endOfMonthParts);
  const in14Parts = addDaysToDateParts(todayParts, 14);
  const daylightIn14Days = astronomy.getDaylightMinutesForDateParts(in14Parts);
  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterdayDaylight = astronomy.getDaylightMinutesForDateParts(yesterdayParts);
  const daylightGainToday =
    todayDaylight != null && yesterdayDaylight != null
      ? todayDaylight - yesterdayDaylight
      : null;
  const daylightGainThisWeek =
    todayDaylight != null && weekDaylight != null ? todayDaylight - weekDaylight : null;
  const daylightLossThisWeek =
    todayDaylight != null && weekDaylight != null ? weekDaylight - todayDaylight : null;
  const daylightLossThisMonthRaw =
    monthDaylight != null && todayDaylight != null ? monthDaylight - todayDaylight : null;
  const daylightLossThisMonth =
    daylightLossThisMonthRaw != null && daylightLossThisMonthRaw > 0
      ? daylightLossThisMonthRaw
      : null;
  const daylightLossLastMonthRaw =
    twoMonthsDaylight != null && monthDaylight != null
      ? twoMonthsDaylight - monthDaylight
      : null;
  const daylightLossLastMonth =
    daylightLossLastMonthRaw != null && daylightLossLastMonthRaw > 0
      ? daylightLossLastMonthRaw
      : null;
  const daylightAfter5pm =
    todaySunsetMinutes != null ? Math.max(0, todaySunsetMinutes - 17 * 60) : null;
  const daysUntilSunsetAfter5pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    17 * 60
  );
  const daysUntilSunsetAfter6pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    18 * 60
  );
  const daysUntilSunsetAfter7pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    19 * 60
  );
  const daysUntilMaxDailyGain = maxDailyGainDateParts
    ? getDaysBetweenDateParts(todayParts, maxDailyGainDateParts)
    : null;
  const currentSeasonParts = astronomy.getSeasonDatePartsForYear(todayParts.year, hemisphere);
  const previousSummerSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "summer"
  );
  const springEquinoxDate = getLocalNoonDateFromParts(currentSeasonParts.spring, timeZone);
  const summerSolsticeDate = getLocalNoonDateFromParts(previousSummerSolsticeParts, timeZone);
  const winterSolsticeDate = getLocalNoonDateFromParts(currentSeasonParts.winter, timeZone);
  const daysUntilSummerSolsticeRaw = currentSeasonParts.summer
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.summer)
    : null;
  const daysUntilSummerSolstice =
    daysUntilSummerSolsticeRaw != null && daysUntilSummerSolsticeRaw > 0
      ? daysUntilSummerSolsticeRaw
      : null;
  const daysUntilWinterSolsticeRaw = currentSeasonParts.winter
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.winter)
    : null;
  const daysUntilWinterSolstice =
    daysUntilWinterSolsticeRaw != null && daysUntilWinterSolsticeRaw > 0
      ? daysUntilWinterSolsticeRaw
      : null;
  const daysUntilEarliestSunset = earliestSunsetDateParts
    ? getDaysBetweenDateParts(todayParts, earliestSunsetDateParts)
    : null;
  const daysInYear = getDaysInYear(todayParts.year);

  let fractionOfLossCompleted = null;
  if (
    todayDaylight != null &&
    Number.isFinite(longestDayMinutes) &&
    Number.isFinite(shortestDayMinutes)
  ) {
    const totalLoss = longestDayMinutes - shortestDayMinutes;
    if (totalLoss > 0) {
      fractionOfLossCompleted = clampValue(
        (longestDayMinutes - todayDaylight) / totalLoss,
        0,
        1
      );
    }
  }

  const weeksWithSunsetAfter7pmRemaining =
    todaySunsetMinutes != null
      ? astronomy.getWeeksWithSunsetAfter(todayParts, 19 * 60)
      : null;
  const averageWinterDaylight = astronomy.getAverageWinterDaylight(
    currentSeasonParts.winter,
    hemisphere
  );
  const todayDate = getLocalNoonDateFromParts(todayParts, timeZone);
  const earliestSunsetDate = getLocalNoonDateFromParts(earliestSunsetDateParts, timeZone);

  const messageData = {
    sunset_today: todaySunsetMinutes,
    sunset_earliest: earliestSunsetMinutes,
    sunset_start_of_year: sunsetStartOfYear,
    sunset_one_month_ago: monthSunsetMinutes,
    daylight_minimum: shortestDayMinutes,
    daylight_at_end_of_month: daylightAtEndOfMonth,
    daylight_today: todayDaylight,
    daylight_after_5pm_today: daylightAfter5pm,
    daylight_one_month_ago: monthDaylight,
    fraction_of_loss_completed: fractionOfLossCompleted,
    daylight_daily_gain_this_week_min: astronomy.getDaylightDailyGainThisWeekMin(todayParts),
    daylight_in_14_days: daylightIn14Days,
    daylight_gain_this_week: daylightGainThisWeek,
    spring_equinox_date: springEquinoxDate,
    today_date: todayDate,
    daylight_gain_today: daylightGainToday,
    daylight_loss_this_month: daylightLossThisMonth,
    daylight_loss_last_month: daylightLossLastMonth,
    days_until_sunset_after_5pm: daysUntilSunsetAfter5pm,
    days_until_sunset_after_6pm: daysUntilSunsetAfter6pm,
    days_until_sunset_after_7pm: daysUntilSunsetAfter7pm,
    days_until_max_daily_gain: daysUntilMaxDailyGain,
    days_until_summer_solstice: daysUntilSummerSolstice,
    weeks_with_sunset_after_7pm_remaining: weeksWithSunsetAfter7pmRemaining,
    days_until_winter_solstice: daysUntilWinterSolstice,
    days_until_earliest_sunset: daysUntilEarliestSunset,
    daylight_maximum: longestDayMinutes,
    summer_solstice_date: summerSolsticeDate,
    winter_solstice_date: winterSolsticeDate,
    days_with_less_daylight: daysWithLessDaylight,
    days_in_year: daysInYear,
    date_today: todayDate,
    date_of_earliest_sunset: earliestSunsetDate,
    average_winter_daylight: averageWinterDaylight,
    daylight_loss_this_week: daylightLossThisWeek,
  };

  updateOptimisticMessage(messageData, todayParts.month, hemisphere);

  // Build milestones
  const milestoneCandidates = [];
  const addMilestone = (milestoneItem) => {
    if (milestoneItem) milestoneCandidates.push(milestoneItem);
  };

  let nextYearExtremes = null;
  const resolveNextExtreme = (key) => {
    const current = {
      earliestSunsetDateParts,
      shortestDayDateParts,
      longestDayDateParts,
    }[key];
    if (current && compareDateParts(current, todayParts) >= 0) {
      return current;
    }
    if (!nextYearExtremes) {
      nextYearExtremes = astronomy.getYearlySunExtremes(todayParts.year + 1, null);
    }
    return nextYearExtremes[key] || null;
  };

  const previousWinterSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "winter"
  );

  const sunsetThresholdMatches = SUNSET_THRESHOLD_MILESTONES.map((milestoneConfig) => ({
    ...milestoneConfig,
    match: astronomy.findFirstSunsetAfter(
      previousWinterSolsticeParts,
      milestoneConfig.minutes
    ),
  }));

  // Next half-hour sunset milestone
  if (todaySunsetMinutes != null) {
    const targetMinutes = astronomy.getNextHalfHour(todaySunsetMinutes);
    if (targetMinutes > 0) {
      const targetLabel = formatTimeFromMinutes(targetMinutes, todayParts, timeZone);
      const milestoneMatch = astronomy.findNextSunsetThreshold(todayParts, targetMinutes);
      if (milestoneMatch) {
        const isThresholdDuplicate = sunsetThresholdMatches.some(
          (threshold) =>
            threshold.minutes === targetMinutes &&
            threshold.match?.dateParts &&
            compareDateParts(threshold.match.dateParts, milestoneMatch.dateParts) === 0
        );
        if (!isThresholdDuplicate) {
          addMilestone(
            buildMilestone({
              id: `next-sunset-${targetMinutes}`,
              title: `Next ${targetLabel} Sunset`,
              dateParts: milestoneMatch.dateParts,
            })
          );
        }
      }
    }
  }

  addMilestone(
    buildMilestone({
      id: "earliest-sunset",
      title: "Earliest sunset",
      dateParts: resolveNextExtreme("earliestSunsetDateParts"),
      todayHeadline: "It's the earliest sunset of the year.",
      todayLede: "Brighter evenings are on the way.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "shortest-day",
      title: "Shortest day",
      dateParts: resolveNextExtreme("shortestDayDateParts"),
      todayHeadline: "Today is the shortest day of the year.",
      todayLede: "Longer days start tomorrow.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "longest-day",
      title: "Longest day",
      dateParts: resolveNextExtreme("longestDayDateParts"),
      todayHeadline: "Today is the longest day of the year.",
      todayLede: "Soak up every extra minute.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "spring-equinox",
      title: "Spring equinox",
      dateParts: astronomy.getNextSeasonDateParts(todayParts, hemisphere, "spring"),
      todayHeadline: "It's the spring equinox today.",
      todayLede: null,
    })
  );
  addMilestone(
    buildMilestone({
      id: "dst-start",
      title: "Daylight savings time starts",
      dateParts: astronomy.findNextDaylightSavingsStart(todayParts),
      todayHeadline: "Daylight savings time starts today.",
      todayLede: "Don't forget to spring forward.",
    })
  );

  const firstTwelveHours = astronomy.findFirstDaylightAtLeast(
    previousWinterSolsticeParts,
    12 * 60
  );
  addMilestone(
    buildMilestone({
      id: "first-12-hours",
      title: "First day with at least 12 hours of daylight",
      dateParts: firstTwelveHours?.dateParts,
      todayHeadline: "Today has at least 12 hours of daylight.",
      todayLede: "A perfect balance of day and night.",
    })
  );

  sunsetThresholdMatches.forEach((milestoneConfig) => {
    addMilestone(
      buildMilestone({
        id: milestoneConfig.id,
        title: milestoneConfig.title,
        dateParts: milestoneConfig.match?.dateParts,
        todayHeadline: milestoneConfig.todayHeadline,
        todayLede: milestoneConfig.todayLede,
      })
    );
  });

  DAYLIGHT_GAIN_MILESTONES.forEach((milestoneConfig) => {
    const match = astronomy.findFirstDaylightGain(
      previousWinterSolsticeParts,
      milestoneConfig.minutes
    );
    addMilestone(
      buildMilestone({
        id: milestoneConfig.id,
        title: milestoneConfig.title,
        dateParts: match?.dateParts,
        todayHeadline: milestoneConfig.todayHeadline,
        todayLede: milestoneConfig.todayLede,
      })
    );
  });

  const milestoneOffsets = milestoneCandidates
    .map((item) => withMilestoneOffset(item, todayParts))
    .filter(Boolean);

  const todayMilestone = milestoneOffsets.find((item) => item.offsetDays === 0);
  if (todayMilestone) {
    stopOptimisticRotation(headline, lede);
    const todayCopy = getMilestoneTodayCopy(todayMilestone);
    if (todayCopy) {
      setOptimisticCopy(headline, lede, todayCopy, { animate: false });
    }
    celebrateMilestone(confettiRoot, todayMilestone);
  } else {
    celebrateMilestone(confettiRoot, null);
  }

  const upcoming = milestoneOffsets
    .filter((item) => item.offsetDays > 0)
    .sort((a, b) => {
      const dayDiff = a.offsetDays - b.offsetDays;
      if (dayDiff !== 0) return dayDiff;
      return a.title.localeCompare(b.title);
    });

  updateMilestoneCard(
    { nextHeadline: dom.nextHeadline, nextDate: dom.nextDate, nextAway: dom.nextAway, milestone, milestoneToggle },
    upcoming,
    timeZone,
    formatLongDateFromParts
  );

  // Update share snapshot
  updateShareSnapshot({
    location,
    timeZone,
    dateParts: todayParts,
    todayDaylight,
    daylightGainToday,
    longestDayMinutes,
    shortestDayMinutes,
    sunsetEarliestDelta,
    hemisphere,
    fractionOfLossCompleted,
  });
};

// ============================================================================
// Event Handlers Setup
// ============================================================================

// Initialize recent locations from storage
setRecentLocations(loadRecentLocations());

// City input handlers
if (cityInput) {
  cityInput.addEventListener("input", handleInput);
  cityInput.addEventListener("focus", handleInput);
  cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearResults();
      return;
    }
    if (!getSuggestionResults().length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateActiveOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateActiveOption(getSuggestionResults().length - 1);
    } else if (event.key === "Enter") {
      const activeIndex = getActiveIndex();
      const suggestionResults = getSuggestionResults();
      if (activeIndex >= 0) {
        event.preventDefault();
        selectResult(suggestionResults[activeIndex]);
      } else if (suggestionResults.length) {
        event.preventDefault();
        selectResult(suggestionResults[0]);
      }
    }
  });
}

// Clear button handler
if (clearButton && cityInput) {
  clearButton.addEventListener("click", () => {
    setInputValue(cityInput, "");
    setLastNameQuery("");
    setLastFilterTokens([]);
    setLastFilterTokensRaw([]);
    updateClearButton();
    if (getRecentLocations().length) {
      showRecentResults();
    } else {
      clearResults();
    }
    cityInput.focus();
  });
}

// Geolocation button handler
if (geolocateButton && cityInput) {
  geolocateButton.addEventListener("click", () => {
    requestLocationBias();
    cityInput.focus();
  });
}

// Date input handlers
if (dateInput) {
  const handleDateCommitInput = () => {
    if (isRecentDateKeyboardInput()) return;
    scheduleDateCommit();
  };

  dateInput.addEventListener("input", handleDateCommitInput);
  dateInput.addEventListener("change", handleDateCommitInput);
  dateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitDateSelection();
      return;
    }
    if (
      event.key === "Tab" ||
      event.key === "Shift" ||
      event.key === "Alt" ||
      event.key === "Control" ||
      event.key === "Meta"
    ) {
      return;
    }
    setLastKeydownAt(Date.now());
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("pointerdown", () => {
    setLastKeydownAt(0);
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("blur", () => {
    clearDateCommitTimeout();
    commitDateSelection();
  });
}

// Date reset button handler
if (dateReset) {
  dateReset.addEventListener("click", () => {
    clearDateCommitTimeout();
    setLastKeydownAt(0);
    const didChange = applyDateSelection(null);
    const timeZone = getActiveLocation()?.timezone || FALLBACK_TIMEZONE;
    syncDatePicker(timeZone);
    if (getActiveLocation() && didChange) {
      updateDaylightForLocation(getActiveLocation());
    }
  });
}

// Milestone toggle handler
if (milestoneToggle) {
  milestoneToggle.addEventListener("click", () => {
    const upcoming = getUpcomingMilestones();
    if (!upcoming.length) return;
    const currentIndex = getMilestoneIndex();
    const nextIndex = (currentIndex + 1) % upcoming.length;
    setMilestoneIndex(nextIndex);
    updateMilestoneCard(
      { nextHeadline: dom.nextHeadline, nextDate: dom.nextDate, nextAway: dom.nextAway, milestone, milestoneToggle },
      upcoming,
      getMilestoneTimeZone() || FALLBACK_TIMEZONE,
      formatLongDateFromParts,
      { resetIndex: false }
    );
  });
}

// Results list handlers
if (resultsList) {
  resultsList.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".location-option");
    if (!target) return;
    const index = Number(target.dataset.index);
    const item = getSuggestionResults()[index];
    if (item) selectResult(item);
  });

  resultsList.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".location-option");
    if (!target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = Number(target.dataset.index);
      const item = getSuggestionResults()[index];
      if (item) selectResult(item);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() + 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[getActiveIndex()]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() - 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[getActiveIndex()]?.focus();
    } else if (event.key === "Escape") {
      clearResults();
      cityInput?.focus();
    }
  });
}

// Results actions handlers
if (resultsActions) {
  resultsActions.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest("[data-action]");
    if (!action) return;
    event.stopPropagation();
    const actionType = action.dataset.action;
    if (actionType === "toggle-preference") {
      togglePreferLocalResults();
      const rawResults = getRawResults();
      if (rawResults.length) {
        buildResults(rawResults, getLastFilterTokens(), getLastFilterTokensRaw());
      }
    } else if (actionType === "retry") {
      const nameQuery = getLastNameQuery();
      if (nameQuery.length >= 2) {
        fetchSuggestions(nameQuery, getLastFilterTokens(), getLastFilterTokensRaw());
      } else {
        clearResults();
      }
    }
  });
}

// Close results when clicking/focusing outside
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".location")) {
    clearResults();
  }
});

document.addEventListener("focusin", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".location")) {
    clearResults();
  }
});

window.addEventListener("resize", updateResultsMaxHeight);

// Initialize tooltips
const deltaTooltipTargets = [
  dom.sunsetEarliestReference,
  dom.sunsetComparisonReference,
  dom.daylightShortestReference,
  dom.daylightComparisonReference,
].filter(Boolean);

deltaTooltipTargets.forEach((target) => {
  initializeTooltipTarget(target, deltaTooltipTargets);
});

initializeGlobalTooltipHandlers(deltaTooltipTargets);

// ============================================================================
// Share Modal Setup
// ============================================================================

// Initialize share privacy preference
setSharePrivacyEnabled(loadSharePrivacyPreference());

if (sharePrivacyToggle) {
  sharePrivacyToggle.checked = isSharePrivacyEnabled();
  sharePrivacyToggle.addEventListener("change", () => {
    setSharePrivacyEnabled(sharePrivacyToggle.checked);
    saveSharePrivacyPreference(sharePrivacyToggle.checked);
    if (shareModal?.open || shareModal?.hasAttribute("open")) {
      refreshSharePreview(
        sharePreview,
        headline,
        lede,
        getActiveDateParts,
        languageCode,
        FALLBACK_TIMEZONE
      );
    }
  });
}

if (shareModalClose) {
  shareModalClose.addEventListener("click", () => {
    closeShareModal(shareModal);
  });
}

if (shareModal) {
  shareModal.addEventListener("click", (event) => {
    if (event.target === shareModal) {
      closeShareModal(shareModal);
    }
  });
  shareModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeShareModal(shareModal);
  });
}

if (shareActionButtons.length) {
  shareActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.share;
      if (!action) return;
      try {
        if (action === "copy") {
          const success = await copyShareText(headline, lede, getActiveDateParts, languageCode, FALLBACK_TIMEZONE);
          if (success) flashActionLabel(button, "Copied!");
          return;
        }
        if (action === "instagram") {
          const success = await copyShareText(headline, lede, getActiveDateParts, languageCode, FALLBACK_TIMEZONE);
          if (success) flashActionLabel(button, "Copied!");
          openShareLink("https://www.instagram.com/");
          return;
        }
        const { ensureShareText } = await import("./ui/share-modal-ui.js");
        const text = await ensureShareText(headline, lede, getActiveDateParts, languageCode, FALLBACK_TIMEZONE);
        const encodedText = encodeURIComponent(text);
        if (action === "facebook") {
          const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            "https://sunshineoptimist.com"
          )}&quote=${encodedText}`;
          openShareLink(url);
          return;
        }
        if (action === "x") {
          const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
          openShareLink(url);
          return;
        }
        if (action === "bluesky") {
          const url = `https://bsky.app/intent/compose?text=${encodedText}`;
          openShareLink(url);
        }
      } catch (error) {
        console.warn("Share action failed:", error);
      }
    });
  });
}

if (shareButton) {
  shareButton.addEventListener("click", () => {
    openShareModal(
      shareModal,
      sharePreview,
      headline,
      lede,
      getActiveDateParts,
      languageCode,
      FALLBACK_TIMEZONE
    );
  });
}

// ============================================================================
// Debug API
// ============================================================================

const getOptimisticDebugSnapshot = () => {
  const debugState = getOptimisticDebugState();
  return {
    validOptions: debugState.validOptions,
    displayedOptions: debugState.displayedOptions,
    data: debugState.data,
    month: debugState.month,
    hemisphere: debugState.hemisphere,
    reason: debugState.reason,
    lastUpdatedAt: debugState.lastUpdatedAt,
  };
};

window.SunshineOptimistDebug = {
  getOptimisticMessages: getOptimisticDebugSnapshot,
  printOptimisticMessages: () => {
    const snapshot = getOptimisticDebugSnapshot();
    const list = snapshot.validOptions.length
      ? snapshot.validOptions
      : snapshot.displayedOptions;
    if (typeof console.table === "function") {
      console.table(
        list.map((item, index) => ({
          index,
          headline: item?.headline || "",
          lede: item?.lede || "",
        }))
      );
    } else {
      console.log(list);
    }
    return snapshot;
  },
};

// ============================================================================
// Initialize Application
// ============================================================================

syncDatePicker(FALLBACK_TIMEZONE);
updateGeolocateButton();
initializeLocation();
