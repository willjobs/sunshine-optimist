import { fetchWithTimeout } from "./fetch-service.js";

const FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast";

export const isValidTimeZone = (timeZone) => {
  if (typeof timeZone !== "string" || !timeZone.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolve the IANA timezone that applies to a coordinate pair.
 * Open-Meteo derives the timezone when `timezone=auto` is requested.
 */
export const fetchCoordinateTimeZone = async ({ latitude, longitude }) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const url = `${FORECAST_API_URL}?latitude=${encodeURIComponent(
    latitude
  )}&longitude=${encodeURIComponent(longitude)}&timezone=auto&forecast_days=1`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error("Failed to resolve location timezone.");
  }

  const data = await response.json();
  return isValidTimeZone(data?.timezone) ? data.timezone : null;
};
