/**
 * localStorage abstraction for persisting user preferences and data
 */

const RECENT_STORAGE_KEY = "sunshine-optimist:recent-locations";
const ACTIVE_LOCATION_STORAGE_KEY = "sunshine-optimist:active-location";
const SHARE_PRIVACY_STORAGE_KEY = "sunshine-optimist:share-privacy";

/**
 * Sanitize location object for storage (removes transient fields)
 */
const sanitizeStoredLocation = (location) => {
  if (!location || typeof location !== "object") {
    return location;
  }
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
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to load recent locations:", error);
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
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    const { reverseGeocodeFailed, ...sanitized } = parsed;
    return sanitized;
  } catch (error) {
    console.warn("Unable to load stored location:", error);
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
