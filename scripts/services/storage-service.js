/**
 * localStorage abstraction for persisting user preferences and data
 */

import { isValidTimeZone } from "./timezone-service.js";

const RECENT_STORAGE_KEY = "sunshine-optimist:recent-locations";
const ACTIVE_LOCATION_STORAGE_KEY = "sunshine-optimist:active-location";
const SHARE_PRIVACY_STORAGE_KEY = "sunshine-optimist:share-privacy";
const isMissing = (value) => value === null || value === undefined;

const isValidStoredLocation = (location) =>
  Boolean(location) &&
  typeof location === "object" &&
  !Array.isArray(location) &&
  typeof location.name === "string" &&
  location.name.trim().length > 0 &&
  Number.isFinite(location.latitude) &&
  location.latitude >= -90 &&
  location.latitude <= 90 &&
  Number.isFinite(location.longitude) &&
  location.longitude >= -180 &&
  location.longitude <= 180 &&
  (isMissing(location.timezone) || isValidTimeZone(location.timezone)) &&
  (isMissing(location.elevation) || Number.isFinite(location.elevation)) &&
  (isMissing(location.isCurrent) || typeof location.isCurrent === "boolean") &&
  ["admin1", "admin2", "country", "country_code"].every(
    (key) => isMissing(location[key]) || typeof location[key] === "string"
  );

const removeStoredValue = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; callers still receive a safe fallback.
  }
};

/**
 * Sanitize location object for storage (removes transient fields)
 */
const sanitizeStoredLocation = (location) => {
  if (!location || typeof location !== "object") {
    return location;
  }
  // eslint-disable-next-line no-unused-vars
  const { reverseGeocodeFailed, ...sanitized } = location;
  return sanitized;
};

// ============================================================================
// Recent Locations
// ============================================================================

export const loadRecentLocations = () => {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) {
      removeStoredValue(RECENT_STORAGE_KEY);
      return [];
    }
    const valid = parsed.filter(isValidStoredLocation);
    if (valid.length !== parsed.length) {
      saveRecentLocations(valid);
    }
    return valid;
  } catch (error) {
    console.warn("Unable to load recent locations:", error);
    removeStoredValue(RECENT_STORAGE_KEY);
    return [];
  }
};

export const saveRecentLocations = (items) => {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Unable to save recent locations:", error);
  }
};

// ============================================================================
// Active Location
// ============================================================================

export const loadStoredLocation = () => {
  try {
    const stored = localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (!isValidStoredLocation(parsed)) {
      if (stored) removeStoredValue(ACTIVE_LOCATION_STORAGE_KEY);
      return null;
    }
    // eslint-disable-next-line no-unused-vars
    const { reverseGeocodeFailed, ...sanitized } = parsed;
    return sanitized;
  } catch (error) {
    console.warn("Unable to load stored location:", error);
    removeStoredValue(ACTIVE_LOCATION_STORAGE_KEY);
    return null;
  }
};

export const saveStoredLocation = (location) => {
  try {
    localStorage.setItem(
      ACTIVE_LOCATION_STORAGE_KEY,
      JSON.stringify(sanitizeStoredLocation(location))
    );
  } catch (error) {
    console.warn("Unable to save stored location:", error);
  }
};

// ============================================================================
// Share Privacy Preference
// ============================================================================

export const loadSharePrivacyPreference = () => {
  try {
    return localStorage.getItem(SHARE_PRIVACY_STORAGE_KEY) === "true";
  } catch (error) {
    console.warn("Unable to load share privacy preference:", error);
    return false;
  }
};

export const saveSharePrivacyPreference = (value) => {
  try {
    localStorage.setItem(SHARE_PRIVACY_STORAGE_KEY, value ? "true" : "false");
  } catch (error) {
    console.warn("Unable to save share privacy preference:", error);
  }
};
