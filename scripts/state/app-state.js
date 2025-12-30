/**
 * Centralized state management for Sunshine Optimist
 * All application state is consolidated here with clear getters and setters
 */

// ============================================================================
// Location State
// ============================================================================
const locationState = {
  suggestionResults: [],
  rawResults: [],
  activeIndex: -1,
  debounceId: null,
  fetchController: null,
  preferLocalResults: true,
  lastNameQuery: "",
  locationBiasRequested: false,
  locationBiasLoading: false,
  userCoords: null,
  lastFilterTokens: [],
  lastFilterTokensRaw: [],
  recentLocations: [],
  activeLocation: null,
};

// ============================================================================
// Date State
// ============================================================================
const dateState = {
  useLiveDate: true,
  customDateParts: null,
  commitTimeoutId: null,
  lastKeydownAt: 0,
};

// ============================================================================
// Milestone State
// ============================================================================
const milestoneState = {
  upcoming: [],
  index: 0,
  timeZone: null,
  lastCelebratedKey: null,
  confettiTimeoutId: null,
};

// ============================================================================
// Optimistic Message State
// ============================================================================
const optimisticState = {
  options: [],
  index: 0,
  rotationId: null,
  swapId: 0,
  swapTimeoutId: null,
};

// ============================================================================
// Debug State (for console logging)
// ============================================================================
const optimisticDebugState = {
  validOptions: [],
  displayedOptions: [],
  data: null,
  month: null,
  hemisphere: null,
  reason: "uninitialized",
  lastUpdatedAt: null,
};

// ============================================================================
// Share State
// ============================================================================
const shareState = {
  snapshot: null,
  modalSnapshot: null,
  privacyEnabled: false,
  text: "",
};

// ============================================================================
// Reverse Geocode Cache State
// ============================================================================
const reverseGeocodeState = {
  cache: null,
  cacheKey: "",
  promise: null,
};

// ============================================================================
// Location State Accessors
// ============================================================================

export const getLocationState = () => locationState;

export const getSuggestionResults = () => locationState.suggestionResults;
export const setSuggestionResults = (results) => {
  locationState.suggestionResults = results;
};

export const getRawResults = () => locationState.rawResults;
export const setRawResults = (results) => {
  locationState.rawResults = results;
};

export const getActiveIndex = () => locationState.activeIndex;
export const setActiveIndex = (index) => {
  locationState.activeIndex = index;
};

export const getDebounceId = () => locationState.debounceId;
export const setDebounceId = (id) => {
  locationState.debounceId = id;
};

export const getFetchController = () => locationState.fetchController;
export const setFetchController = (controller) => {
  locationState.fetchController = controller;
};

export const getPreferLocalResults = () => locationState.preferLocalResults;
export const setPreferLocalResults = (prefer) => {
  locationState.preferLocalResults = prefer;
};
export const togglePreferLocalResults = () => {
  locationState.preferLocalResults = !locationState.preferLocalResults;
};

export const getLastNameQuery = () => locationState.lastNameQuery;
export const setLastNameQuery = (query) => {
  locationState.lastNameQuery = query;
};

export const isLocationBiasRequested = () => locationState.locationBiasRequested;
export const setLocationBiasRequested = (requested) => {
  locationState.locationBiasRequested = requested;
};

export const isLocationBiasLoading = () => locationState.locationBiasLoading;
export const setLocationBiasLoading = (loading) => {
  locationState.locationBiasLoading = loading;
};

export const getUserCoords = () => locationState.userCoords;
export const setUserCoords = (coords) => {
  const current = locationState.userCoords;
  const coordsChanged =
    !current ||
    !coords ||
    current.lat !== coords.lat ||
    current.lon !== coords.lon;
  if (coordsChanged) {
    reverseGeocodeState.cache = null;
    reverseGeocodeState.cacheKey = "";
    reverseGeocodeState.promise = null;
  }
  locationState.userCoords = coords;
};

export const getLastFilterTokens = () => locationState.lastFilterTokens;
export const setLastFilterTokens = (tokens) => {
  locationState.lastFilterTokens = tokens;
};

export const getLastFilterTokensRaw = () => locationState.lastFilterTokensRaw;
export const setLastFilterTokensRaw = (tokens) => {
  locationState.lastFilterTokensRaw = tokens;
};

export const getRecentLocations = () => locationState.recentLocations;
export const setRecentLocations = (locations) => {
  locationState.recentLocations = locations;
};

export const getActiveLocation = () => locationState.activeLocation;
export const setActiveLocation = (location) => {
  locationState.activeLocation = location;
};

// ============================================================================
// Date State Accessors
// ============================================================================

export const getDateState = () => dateState;

export const isUsingLiveDate = () => dateState.useLiveDate;
export const setUseLiveDate = (useLive) => {
  dateState.useLiveDate = useLive;
};

export const getCustomDateParts = () => dateState.customDateParts;
export const setCustomDateParts = (parts) => {
  dateState.customDateParts = parts;
};

export const getDateCommitTimeoutId = () => dateState.commitTimeoutId;
export const setDateCommitTimeoutId = (id) => {
  dateState.commitTimeoutId = id;
};

export const getLastKeydownAt = () => dateState.lastKeydownAt;
export const setLastKeydownAt = (timestamp) => {
  dateState.lastKeydownAt = timestamp;
};

// ============================================================================
// Milestone State Accessors
// ============================================================================

export const getMilestoneState = () => milestoneState;

export const getUpcomingMilestones = () => milestoneState.upcoming;
export const setUpcomingMilestones = (milestones) => {
  milestoneState.upcoming = milestones;
};

export const getMilestoneIndex = () => milestoneState.index;
export const setMilestoneIndex = (index) => {
  milestoneState.index = index;
};

export const getMilestoneTimeZone = () => milestoneState.timeZone;
export const setMilestoneTimeZone = (timeZone) => {
  milestoneState.timeZone = timeZone;
};

export const getLastCelebratedKey = () => milestoneState.lastCelebratedKey;
export const setLastCelebratedKey = (key) => {
  milestoneState.lastCelebratedKey = key;
};

export const getConfettiTimeoutId = () => milestoneState.confettiTimeoutId;
export const setConfettiTimeoutId = (id) => {
  milestoneState.confettiTimeoutId = id;
};

// ============================================================================
// Optimistic Message State Accessors
// ============================================================================

export const getOptimisticState = () => optimisticState;

export const getOptimisticOptions = () => optimisticState.options;
export const setOptimisticOptions = (options) => {
  optimisticState.options = options;
};

export const getOptimisticIndex = () => optimisticState.index;
export const setOptimisticIndex = (index) => {
  optimisticState.index = index;
};

export const getRotationId = () => optimisticState.rotationId;
export const setRotationId = (id) => {
  optimisticState.rotationId = id;
};

export const getSwapId = () => optimisticState.swapId;
export const incrementSwapId = () => {
  optimisticState.swapId += 1;
  return optimisticState.swapId;
};

export const getSwapTimeoutId = () => optimisticState.swapTimeoutId;
export const setSwapTimeoutId = (id) => {
  optimisticState.swapTimeoutId = id;
};

// ============================================================================
// Debug State Accessors
// ============================================================================

export const getOptimisticDebugState = () => optimisticDebugState;

export const setDebugValidOptions = (options) => {
  optimisticDebugState.validOptions = options;
};

export const setDebugDisplayedOptions = (options) => {
  optimisticDebugState.displayedOptions = options;
};

export const setDebugData = (data) => {
  optimisticDebugState.data = data;
};

export const setDebugMonth = (month) => {
  optimisticDebugState.month = month;
};

export const setDebugHemisphere = (hemisphere) => {
  optimisticDebugState.hemisphere = hemisphere;
};

export const setDebugReason = (reason) => {
  optimisticDebugState.reason = reason;
};

export const setDebugLastUpdatedAt = (date) => {
  optimisticDebugState.lastUpdatedAt = date;
};

export const updateDebugState = ({ data, month, hemisphere, validOptions, displayedOptions, reason }) => {
  if (data !== undefined) optimisticDebugState.data = data;
  if (month !== undefined) optimisticDebugState.month = month;
  if (hemisphere !== undefined) optimisticDebugState.hemisphere = hemisphere;
  if (validOptions !== undefined) optimisticDebugState.validOptions = validOptions;
  if (displayedOptions !== undefined) optimisticDebugState.displayedOptions = displayedOptions;
  if (reason !== undefined) optimisticDebugState.reason = reason;
  optimisticDebugState.lastUpdatedAt = new Date();
};

// ============================================================================
// Share State Accessors
// ============================================================================

export const getShareState = () => shareState;

export const getShareSnapshot = () => shareState.snapshot;
export const setShareSnapshot = (snapshot) => {
  shareState.snapshot = snapshot;
};

export const getModalSnapshot = () => shareState.modalSnapshot;
export const setModalSnapshot = (snapshot) => {
  shareState.modalSnapshot = snapshot;
};

export const isSharePrivacyEnabled = () => shareState.privacyEnabled;
export const setSharePrivacyEnabled = (enabled) => {
  shareState.privacyEnabled = enabled;
};

export const getShareText = () => shareState.text;
export const setShareText = (text) => {
  shareState.text = text;
};

// ============================================================================
// Reverse Geocode State Accessors
// ============================================================================

export const getReverseGeocodeState = () => reverseGeocodeState;

export const getReverseGeocodeCache = () => reverseGeocodeState.cache;
export const setReverseGeocodeCache = (cache) => {
  reverseGeocodeState.cache = cache;
};

export const getReverseGeocodeCacheKey = () => reverseGeocodeState.cacheKey;
export const setReverseGeocodeCacheKey = (key) => {
  reverseGeocodeState.cacheKey = key;
};

export const getReverseGeocodePromise = () => reverseGeocodeState.promise;
export const setReverseGeocodePromise = (promise) => {
  reverseGeocodeState.promise = promise;
};

export const clearReverseGeocodeCache = () => {
  reverseGeocodeState.cache = null;
  reverseGeocodeState.cacheKey = "";
  reverseGeocodeState.promise = null;
};

// ============================================================================
// Bulk State Reset (for testing or reinitialization)
// ============================================================================

export const resetLocationSearchState = () => {
  locationState.suggestionResults = [];
  locationState.rawResults = [];
  locationState.activeIndex = -1;
  if (locationState.debounceId) {
    clearTimeout(locationState.debounceId);
    locationState.debounceId = null;
  }
  if (locationState.fetchController) {
    locationState.fetchController.abort();
    locationState.fetchController = null;
  }
};

// ============================================================================
// State Batching
// ============================================================================

let batchDepth = 0;
let batchedCallbacks = [];

export const batchStateUpdates = (callback) => {
  batchDepth += 1;
  try {
    return callback();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && batchedCallbacks.length) {
      const callbacks = batchedCallbacks;
      batchedCallbacks = [];
      callbacks.forEach((cb) => cb());
    }
  }
};

export const scheduleAfterBatch = (callback) => {
  if (batchDepth === 0) {
    callback();
  } else {
    batchedCallbacks.push(callback);
  }
};

export const isBatching = () => batchDepth > 0;
