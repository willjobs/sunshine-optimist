/**
 * BigDataCloud Reverse Geocoding API service
 * Converts coordinates to human-readable place names
 */

import {
  getReverseGeocodeCache,
  setReverseGeocodeCache,
  getReverseGeocodeCacheKey,
  setReverseGeocodeCacheKey,
  getReverseGeocodePromise,
  setReverseGeocodePromise,
} from "../state/app-state.js";

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * Map reverse geocode response to normalized location object
 */
const mapReverseGeocodeResponse = (data, location) => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const name =
    [data.locality, data.city, data.principalSubdivision, data.countryName].find(
      (value) => typeof value === "string" && value.trim()
    ) || "";
  if (!name) {
    return null;
  }
  const latitude = Number.isFinite(data.latitude)
    ? data.latitude
    : location.latitude;
  const longitude = Number.isFinite(data.longitude)
    ? data.longitude
    : location.longitude;
  return {
    name,
    admin1: data.principalSubdivision || "",
    admin2: "",
    country: data.countryName || "",
    country_code: data.countryCode || "",
    latitude,
    longitude,
    elevation: 0,
    timezone: location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
};

/**
 * Fetch location details from coordinates
 * @param {Object} location - Location object with latitude and longitude
 * @param {string} languageCode - The language code for results
 * @returns {Promise<Object|null>} Resolved location or null on failure
 */
export const fetchReverseGeocodeLocation = async (location, languageCode = "en") => {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  const cacheKey = `${location.latitude},${location.longitude}`;

  // Check cache
  if (getReverseGeocodeCache() && getReverseGeocodeCacheKey() === cacheKey) {
    return getReverseGeocodeCache();
  }

  // Check if there's a pending request for this location
  if (getReverseGeocodePromise() && getReverseGeocodeCacheKey() === cacheKey) {
    return getReverseGeocodePromise();
  }

  setReverseGeocodeCacheKey(cacheKey);

  const fetchPromise = (async () => {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=${encodeURIComponent(
      languageCode
    )}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to reverse geocode location.");
      }
      const data = await response.json();
      return mapReverseGeocodeResponse(data, location);
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      return null;
    }
  })();

  setReverseGeocodePromise(fetchPromise);

  const resolved = await fetchPromise;
  setReverseGeocodePromise(null);
  setReverseGeocodeCache(resolved);

  return resolved;
};
