/**
 * Open-Meteo Geocoding API service for city search
 */

const GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * Map API response to normalized location objects
 */
const mapGeocodingResults = (data) =>
  (data.results || []).map((item) => ({
    name: item.name,
    admin1: item.admin1,
    admin2: item.admin2,
    country: item.country,
    country_code: item.country_code,
    latitude: item.latitude,
    longitude: item.longitude,
    elevation: item.elevation,
    timezone: item.timezone,
  }));

/**
 * Search for cities by name
 * @param {string} nameQuery - The city name to search for
 * @param {string} languageCode - The language code for results
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Array>} Array of location objects
 */
export const searchCities = async (nameQuery, languageCode, signal) => {
  const url = `${GEOCODING_API_URL}?name=${encodeURIComponent(
    nameQuery
  )}&count=20&language=${encodeURIComponent(languageCode)}&format=json`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch city suggestions.");
  }
  const data = await response.json();
  return mapGeocodingResults(data);
};

/**
 * Fetch the default location (Boston, MA)
 * @param {string} languageCode - The language code for results
 * @returns {Promise<Object|null>} The default location or null if not found
 */
export const fetchDefaultLocationData = async (languageCode) => {
  const url = `${GEOCODING_API_URL}?name=Boston&count=10&language=${encodeURIComponent(
    languageCode
  )}&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch default location.");
  }
  const data = await response.json();
  const results = mapGeocodingResults(data);

  // Try to find Boston, MA specifically
  const match =
    results.find(
      (item) =>
        (item.name || "").toLowerCase() === "boston" &&
        (item.country_code || "").toUpperCase() === "US" &&
        (item.admin1 || "").toLowerCase() === "massachusetts"
    ) ||
    results.find(
      (item) =>
        (item.name || "").toLowerCase() === "boston" &&
        (item.country_code || "").toUpperCase() === "US"
    ) ||
    results[0];

  return match || null;
};

/**
 * Default Boston location for fallback
 */
export const DEFAULT_LOCATION = {
  name: "Boston",
  admin1: "Massachusetts",
  country: "United States",
  country_code: "US",
  latitude: 42.3601,
  longitude: -71.0589,
  elevation: 0,
  timezone: "America/New_York",
};
