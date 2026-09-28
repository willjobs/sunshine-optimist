/**
 * Date Picker Controller
 *
 * Manages custom vs live date state, date picker syncing, and debounced commit handling.
 */

import {
  addDaysToDateParts,
  formatDateInputValue,
  getLocalDateParts,
  parseDateInputValue,
  zonedTimeToUtc,
} from "../utils/date-utils.js";
import {
  isUsingLiveDate,
  setUseLiveDate,
  getCustomDateParts,
  setCustomDateParts,
  getDateCommitTimeoutId,
  setDateCommitTimeoutId,
  getLastKeydownAt,
  getActiveLocation,
} from "../state/app-state.js";

// Constants
const DATE_COMMIT_DELAY_MS = 300;
const DATE_KEYBOARD_GRACE_MS = 800;
const LIVE_DATE_REFRESH_GRACE_MS = 100;

// Callback for when date changes require daylight recalculation
let onDateChange = null;
let liveDateRefreshTimeoutId = null;
let lastLiveDateKey = null;

/**
 * Register a callback to be called when the date changes
 * @param {Function} callback - Function to call with the active location
 */
export const setDateChangeCallback = (callback) => {
  onDateChange = callback;
};

/**
 * Get the currently active date parts (custom or live)
 * @param {string} timeZone - The timezone to use for live date
 * @returns {Object} Date parts object with year, month, day
 */
export const getActiveDateParts = (timeZone) => {
  if (!isUsingLiveDate() && getCustomDateParts()) {
    return getCustomDateParts();
  }
  return getLocalDateParts(new Date(), timeZone);
};

const clearLiveDateTimer = () => {
  if (liveDateRefreshTimeoutId !== null) {
    clearTimeout(liveDateRefreshTimeoutId);
    liveDateRefreshTimeoutId = null;
  }
};

export const clearLiveDateRefreshTimeout = () => {
  clearLiveDateTimer();
  lastLiveDateKey = null;
};

/** Schedule a refresh at the next midnight in the active location's timezone. */
export const scheduleLiveDateRefresh = (fallbackTimeZone) => {
  clearLiveDateTimer();
  const location = getActiveLocation();
  if (!location || !isUsingLiveDate()) {
    lastLiveDateKey = null;
    return;
  }

  const timeZone = location.timezone || fallbackTimeZone;
  const now = new Date();
  const todayParts = getLocalDateParts(now, timeZone);
  lastLiveDateKey = formatDateInputValue(todayParts);
  const tomorrowParts = addDaysToDateParts(todayParts, 1);
  const nextMidnight = zonedTimeToUtc(
    tomorrowParts.year,
    tomorrowParts.month,
    tomorrowParts.day,
    0,
    0,
    0,
    timeZone
  );
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime() + LIVE_DATE_REFRESH_GRACE_MS);
  liveDateRefreshTimeoutId = window.setTimeout(() => {
    liveDateRefreshTimeoutId = null;
    refreshLiveDateIfNeeded(fallbackTimeZone);
  }, delay);
};

/** Catch a midnight transition missed while the browser was suspended. */
export const refreshLiveDateIfNeeded = (fallbackTimeZone) => {
  const location = getActiveLocation();
  if (!location || !isUsingLiveDate()) {
    clearLiveDateRefreshTimeout();
    return false;
  }

  const timeZone = location.timezone || fallbackTimeZone;
  const currentKey = formatDateInputValue(getLocalDateParts(new Date(), timeZone));
  const didChange = lastLiveDateKey !== null && currentKey !== lastLiveDateKey;
  lastLiveDateKey = currentKey;
  if (didChange && onDateChange) {
    onDateChange(location);
  }
  scheduleLiveDateRefresh(fallbackTimeZone);
  return didChange;
};

/**
 * Sync the date picker UI with the current state
 * @param {HTMLInputElement} dateInput - The date input element
 * @param {HTMLButtonElement} dateReset - The reset button element
 * @param {HTMLElement} datePicker - The date picker container
 * @param {string} timeZone - The timezone for formatting
 */
export const syncDatePicker = (dateInput, dateReset, datePicker, timeZone) => {
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

/**
 * Clear any pending date commit timeout
 */
export const clearDateCommitTimeout = () => {
  const timeoutId = getDateCommitTimeoutId();
  if (timeoutId) {
    clearTimeout(timeoutId);
    setDateCommitTimeoutId(null);
  }
};

/**
 * Apply a date selection to state
 * @param {Object|null} nextParts - The new date parts, or null to reset to live
 * @returns {boolean} Whether the date actually changed
 */
export const applyDateSelection = (nextParts) => {
  if (nextParts) {
    if (nextParts.year < 1900 || nextParts.year > 2100) {
      return false;
    }
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

/**
 * Commit the current date input value
 * @param {HTMLInputElement} dateInput - The date input element
 * @param {HTMLButtonElement} dateReset - The reset button element
 * @param {HTMLElement} datePicker - The date picker container
 * @param {string} fallbackTimeZone - Fallback timezone if no location
 */
export const commitDateSelection = (dateInput, dateReset, datePicker, fallbackTimeZone) => {
  if (!dateInput) return;
  clearDateCommitTimeout();
  const nextParts = parseDateInputValue(dateInput.value);
  const didChange = applyDateSelection(nextParts);
  const timeZone = getActiveLocation()?.timezone || fallbackTimeZone;
  syncDatePicker(dateInput, dateReset, datePicker, timeZone);
  if (getActiveLocation() && didChange && onDateChange) {
    onDateChange(getActiveLocation());
  }
};

/**
 * Schedule a debounced date commit
 * @param {HTMLInputElement} dateInput - The date input element
 * @param {HTMLButtonElement} dateReset - The reset button element
 * @param {HTMLElement} datePicker - The date picker container
 * @param {string} fallbackTimeZone - Fallback timezone if no location
 */
export const scheduleDateCommit = (dateInput, dateReset, datePicker, fallbackTimeZone) => {
  clearDateCommitTimeout();
  const timeoutId = window.setTimeout(() => {
    setDateCommitTimeoutId(null);
    commitDateSelection(dateInput, dateReset, datePicker, fallbackTimeZone);
  }, DATE_COMMIT_DELAY_MS);
  setDateCommitTimeoutId(timeoutId);
};

/**
 * Check if there was recent keyboard input (for grace period)
 * @returns {boolean} Whether keyboard input happened recently
 */
export const isRecentDateKeyboardInput = () =>
  Date.now() - getLastKeydownAt() < DATE_KEYBOARD_GRACE_MS;

/**
 * Reset to live date mode
 * @param {HTMLInputElement} dateInput - The date input element
 * @param {HTMLButtonElement} dateReset - The reset button element
 * @param {HTMLElement} datePicker - The date picker container
 * @param {string} fallbackTimeZone - Fallback timezone if no location
 */
export const resetToLiveDate = (dateInput, dateReset, datePicker, fallbackTimeZone) => {
  clearDateCommitTimeout();
  const didChange = applyDateSelection(null);
  const timeZone = getActiveLocation()?.timezone || fallbackTimeZone;
  syncDatePicker(dateInput, dateReset, datePicker, timeZone);
  if (getActiveLocation() && didChange && onDateChange) {
    onDateChange(getActiveLocation());
  }
};
