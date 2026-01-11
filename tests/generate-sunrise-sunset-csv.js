import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
    elevation: 0,
    timezone: "America/New_York",
  },
  {
    city: "San Francisco, CA",
    country: "United States",
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 0,
    timezone: "America/Los_Angeles",
  },
  {
    city: "Austin, TX",
    country: "United States",
    latitude: 30.2672,
    longitude: -97.7431,
    elevation: 0,
    timezone: "America/Chicago",
  },
  {
    city: "Oslo",
    country: "Norway",
    latitude: 59.9139,
    longitude: 10.7522,
    elevation: 0,
    timezone: "Europe/Oslo",
  },
  {
    city: "Bangkok",
    country: "Thailand",
    latitude: 13.7563,
    longitude: 100.5018,
    elevation: 0,
    timezone: "Asia/Bangkok",
  },
  {
    city: "Auckland",
    country: "New Zealand",
    latitude: -36.8485,
    longitude: 174.7633,
    elevation: 0,
    timezone: "Pacific/Auckland",
  },
  {
    city: "Honolulu, HI",
    country: "United States",
    latitude: 21.3069,
    longitude: -157.8583,
    elevation: 0,
    timezone: "Pacific/Honolulu",
  },
  {
    city: "Barrow, AK",
    country: "United States",
    latitude: 71.29058,
    longitude: -156.78873,
    elevation: 0,
    timezone: "America/Anchorage",
  },
];

const pad2 = (value) => String(value).padStart(2, "0");

const formatTimeLocal = (date, timeZone) => {
  if (!date) {
    return "";
  }
  const { hour, minute } = getZonedParts(date, timeZone);
  return `${pad2(hour)}:${pad2(minute)}`;
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const ensureAstronomy = async () => {
  if (globalThis.Astronomy) {
    return;
  }
  const module = await import("../astronomy-engine/astronomy.browser.js");
  if (!globalThis.Astronomy && module?.default) {
    globalThis.Astronomy = module.default;
  }
};

const buildRowsForLocation = (location) => {
  const daysInYear = getDaysInYear(YEAR);
  const startParts = { year: YEAR, month: 1, day: 1 };
  const astronomy = createAstronomyContext(location, location.timezone);
  const rows = [];

  for (let offset = 0; offset < daysInYear; offset += 1) {
    const dateParts = addDaysToDateParts(startParts, offset);
    const dateValue = formatDateInputValue(dateParts);
    const events = astronomy.getSunEvents(dateParts);
    const sunrise = formatTimeLocal(events.sunrise?.date, location.timezone);
    const sunset = formatTimeLocal(events.sunset?.date, location.timezone);

    rows.push(
      [
        csvEscape(location.city),
        csvEscape(location.country),
        csvEscape(dateValue),
        csvEscape(sunrise),
        csvEscape(sunset),
      ].join(",")
    );
  }

  return rows;
};

const main = async () => {
  await ensureAstronomy();
  const rows = ["city,country,date,sunrise,sunset"];

  LOCATIONS.forEach((location) => {
    rows.push(...buildRowsForLocation(location));
  });

  const outputPath = fileURLToPath(new URL("../sunrise-sunset-2025.csv", import.meta.url));
  await writeFile(outputPath, `${rows.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length - 1} rows to ${outputPath}`);
};

main().catch((error) => {
  console.error("Failed to generate CSV:", error);
  process.exitCode = 1;
});
