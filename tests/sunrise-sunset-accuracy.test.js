import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, it, expect } from "vitest";

import { createAstronomyContext } from "../scripts/utils/astronomy-utils.js";
import {
  addDaysToDateParts,
  formatDateInputValue,
  getDaysInYear,
  getZonedParts,
} from "../scripts/utils/date-utils.js";

const YEAR = 2025;

const LOCATIONS = [
  {
    city: "Boston, MA",
    country: "United States",
    latitude: 42.3601,
    longitude: -71.0589,
    timezone: "America/New_York",
  },
  {
    city: "San Francisco, CA",
    country: "United States",
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: "America/Los_Angeles",
  },
  {
    city: "Austin, TX",
    country: "United States",
    latitude: 30.2672,
    longitude: -97.7431,
    timezone: "America/Chicago",
  },
  {
    city: "Oslo",
    country: "Norway",
    latitude: 59.9139,
    longitude: 10.7522,
    timezone: "Europe/Oslo",
  },
  {
    city: "Bangkok",
    country: "Thailand",
    latitude: 13.7563,
    longitude: 100.5018,
    timezone: "Asia/Bangkok",
  },
  {
    city: "Auckland",
    country: "New Zealand",
    latitude: -36.8485,
    longitude: 174.7633,
    timezone: "Pacific/Auckland",
  },
  {
    city: "Honolulu, HI",
    country: "United States",
    latitude: 21.3069,
    longitude: -157.8583,
    timezone: "Pacific/Honolulu",
  },
  {
    city: "Barrow, AK",
    country: "United States",
    latitude: 71.29058,
    longitude: -156.78873,
    timezone: "America/Anchorage",
  },
];

// Map groundtruth city names to our location city names
const CITY_NAME_MAP = {
  Auckland: "Auckland",
  Bangkok: "Bangkok",
  "Barrow, AK": "Barrow, AK",
  "Boston, MA": "Boston, MA",
  "Honolulu, HI": "Honolulu, HI",
  Oslo: "Oslo",
  "San Francisco, CA": "San Francisco, CA",
  "Austin, TX": "Austin, TX",
};

const pad2 = (value) => String(value).padStart(2, "0");

/**
 * Format a Date to HH:MM in the given timezone
 */
const formatTimeLocal = (date, timeZone) => {
  if (!date) {
    return null;
  }
  const { hour, minute } = getZonedParts(date, timeZone);
  return `${pad2(hour)}:${pad2(minute)}`;
};

/**
 * Parse groundtruth time format (e.g., "6:05 AM", "8:43 PM") to minutes since midnight
 */
const parseGroundtruthTime = (timeStr) => {
  if (!timeStr || timeStr.trim() === "") {
    return null;
  }
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "AM" && hour === 12) {
    hour = 0;
  } else if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
};

/**
 * Parse HH:MM format to minutes since midnight
 */
const parseHHMM = (timeStr) => {
  if (!timeStr || timeStr.trim() === "") {
    return null;
  }
  const match = timeStr.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  return hour * 60 + minute;
};

/**
 * Parse groundtruth date format (e.g., "1/1/25") to { year, month, day }
 */
const parseGroundtruthDate = (dateStr) => {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    month: parseInt(match[1], 10),
    day: parseInt(match[2], 10),
    year: 2000 + parseInt(match[3], 10),
  };
};

/**
 * Parse the groundtruth CSV file
 */
const parseGroundtruthCSV = async () => {
  const csvPath = fileURLToPath(new URL("./groundtruth.csv", import.meta.url));
  const content = await readFile(csvPath, "utf8");
  const lines = content.split("\n");

  // Skip header line (with BOM if present)
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted fields)
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current);

    // Fields: city, country, Latitude, Longitude, date, sunrise, sunset
    if (fields.length >= 7) {
      const city = fields[0];
      const date = fields[4];
      const sunrise = fields[5];
      const sunset = fields[6];

      records.push({
        city,
        date,
        sunrise,
        sunset,
      });
    }
  }

  return records;
};

/**
 * Generate sunrise/sunset times for all locations and dates
 */
const generateCalculatedTimes = () => {
  const results = new Map(); // key: "city|YYYY-MM-DD", value: { sunrise, sunset }

  for (const location of LOCATIONS) {
    const daysInYear = getDaysInYear(YEAR);
    const startParts = { year: YEAR, month: 1, day: 1 };
    const astronomy = createAstronomyContext(location, location.timezone);

    for (let offset = 0; offset < daysInYear; offset++) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const dateValue = formatDateInputValue(dateParts);
      const events = astronomy.getSunEvents(dateParts);

      const sunrise = formatTimeLocal(events.sunrise?.date, location.timezone);
      const sunset = formatTimeLocal(events.sunset?.date, location.timezone);

      const key = `${location.city}|${dateValue}`;
      results.set(key, { sunrise, sunset });
    }
  }

  return results;
};

/**
 * Convert groundtruth date format to YYYY-MM-DD
 */
const groundtruthDateToISO = (dateStr) => {
  const parts = parseGroundtruthDate(dateStr);
  if (!parts) return null;
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
};

let groundtruthRecords;
let calculatedTimes;

beforeAll(async () => {
  // Load astronomy engine
  if (!globalThis.Astronomy) {
    const module = await import("../astronomy-engine/astronomy.browser.js");
    if (!globalThis.Astronomy && module?.default) {
      globalThis.Astronomy = module.default;
    }
  }

  // Load groundtruth and calculate times
  groundtruthRecords = await parseGroundtruthCSV();
  calculatedTimes = generateCalculatedTimes();
});

describe("sunrise-sunset accuracy against groundtruth", () => {
  it("should have loaded groundtruth records", () => {
    expect(groundtruthRecords.length).toBeGreaterThan(0);
  });

  it("should have calculated times for all locations", () => {
    expect(calculatedTimes.size).toBeGreaterThan(0);
  });

  for (const location of LOCATIONS) {
    describe(`${location.city}`, () => {
      it("sunrise times should be within ±1 minute of groundtruth", () => {
        const errors = [];

        for (const record of groundtruthRecords) {
          // Map groundtruth city name to our city name
          const mappedCity = CITY_NAME_MAP[record.city];
          if (mappedCity !== location.city) continue;

          const isoDate = groundtruthDateToISO(record.date);
          if (!isoDate) continue;

          const key = `${location.city}|${isoDate}`;
          const calculated = calculatedTimes.get(key);

          if (!calculated) {
            errors.push(`Missing calculated data for ${key}`);
            continue;
          }

          const groundtruthMinutes = parseGroundtruthTime(record.sunrise);
          const calculatedMinutes = parseHHMM(calculated.sunrise);

          // Both null is OK (polar night/day)
          if (groundtruthMinutes === null && calculatedMinutes === null) {
            continue;
          }

          // One has value, other doesn't - error
          if (groundtruthMinutes === null && calculatedMinutes !== null) {
            errors.push(
              `${record.date}: groundtruth has no sunrise but we calculated ${calculated.sunrise}`
            );
            continue;
          }

          if (groundtruthMinutes !== null && calculatedMinutes === null) {
            errors.push(
              `${record.date}: groundtruth has sunrise ${record.sunrise} but we calculated none`
            );
            continue;
          }

          // Both have values - check difference
          const diff = Math.abs(groundtruthMinutes - calculatedMinutes);
          if (diff > 1) {
            errors.push(
              `${record.date}: sunrise diff ${diff} min (groundtruth: ${record.sunrise}, calculated: ${calculated.sunrise})`
            );
          }
        }

        if (errors.length > 0) {
          expect.fail(`Sunrise accuracy errors:\n${errors.join("\n")}`);
        }
      });

      it("sunset times should be within ±1 minute of groundtruth", () => {
        const errors = [];

        for (const record of groundtruthRecords) {
          const mappedCity = CITY_NAME_MAP[record.city];
          if (mappedCity !== location.city) continue;

          const isoDate = groundtruthDateToISO(record.date);
          if (!isoDate) continue;

          const key = `${location.city}|${isoDate}`;
          const calculated = calculatedTimes.get(key);

          if (!calculated) {
            errors.push(`Missing calculated data for ${key}`);
            continue;
          }

          const groundtruthMinutes = parseGroundtruthTime(record.sunset);
          const calculatedMinutes = parseHHMM(calculated.sunset);

          // Both null is OK (polar night/day)
          if (groundtruthMinutes === null && calculatedMinutes === null) {
            continue;
          }

          // One has value, other doesn't - error
          if (groundtruthMinutes === null && calculatedMinutes !== null) {
            errors.push(
              `${record.date}: groundtruth has no sunset but we calculated ${calculated.sunset}`
            );
            continue;
          }

          if (groundtruthMinutes !== null && calculatedMinutes === null) {
            errors.push(
              `${record.date}: groundtruth has sunset ${record.sunset} but we calculated none`
            );
            continue;
          }

          // Both have values - check difference
          const diff = Math.abs(groundtruthMinutes - calculatedMinutes);
          if (diff > 1) {
            errors.push(
              `${record.date}: sunset diff ${diff} min (groundtruth: ${record.sunset}, calculated: ${calculated.sunset})`
            );
          }
        }

        if (errors.length > 0) {
          expect.fail(`Sunset accuracy errors:\n${errors.join("\n")}`);
        }
      });
    });
  }
});
