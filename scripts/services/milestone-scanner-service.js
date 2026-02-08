/**
 * Milestone Scanner Service
 *
 * Scans major cities to find which ones have a daylight milestone today.
 * Uses a lightweight check that short-circuits on the first matching milestone.
 */

import { createAstronomyContext } from "../utils/astronomy-utils.js";
import { compareDateParts } from "../utils/date-utils.js";
import {
  SUNSET_THRESHOLD_MILESTONES,
  DAYLIGHT_DURATION_MILESTONES,
  DAYLIGHT_GAIN_MILESTONES,
} from "../milestones.js";
import { MAJOR_CITIES } from "../data/major-cities.js";

const MAX_MILESTONE_CITIES = 5;
const YIELD_EVERY = 5;

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Fisher-Yates shuffle (returns a new array). */
const shuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Check if a city has any defined milestone today.
 * Returns the first matching milestone or null.
 * Only checks the 13 defined milestones (sunset thresholds, daylight duration, daylight gain).
 *
 * @param {Object} city - Location object with latitude, longitude, elevation, timezone
 * @param {Function} getDateParts - Function that returns {year, month, day} for a given timezone
 * @returns {{ city: Object, milestone: Object } | null}
 */
export const hasMilestoneToday = (city, getDateParts) => {
  const todayParts = getDateParts(city.timezone);
  const astronomy = createAstronomyContext(city, city.timezone);
  const hemisphere = city.latitude < 0 ? "south" : "north";
  const previousWinterSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "winter"
  );

  if (!previousWinterSolsticeParts) return null;

  const allMilestones = [
    ...SUNSET_THRESHOLD_MILESTONES.map((m) => ({ ...m, type: "sunset" })),
    ...DAYLIGHT_DURATION_MILESTONES.map((m) => ({ ...m, type: "duration" })),
    ...DAYLIGHT_GAIN_MILESTONES.map((m) => ({ ...m, type: "gain" })),
  ];

  for (const milestone of allMilestones) {
    let match = null;
    if (milestone.type === "sunset") {
      match = astronomy.findFirstSunsetAfter(previousWinterSolsticeParts, milestone.minutes);
    } else if (milestone.type === "duration") {
      match = astronomy.findFirstDaylightAtLeast(previousWinterSolsticeParts, milestone.minutes);
    } else if (milestone.type === "gain") {
      match = astronomy.findFirstDaylightGain(previousWinterSolsticeParts, milestone.minutes);
    }

    if (match && compareDateParts(match.dateParts, todayParts) === 0) {
      return { city, milestone };
    }
  }

  return null;
};

/**
 * Scan major cities for milestones occurring today.
 * Yields to the main thread periodically to avoid blocking the UI.
 * Stops early once MAX_MILESTONE_CITIES matches are found.
 *
 * @param {Function} getDateParts - Function that returns {year, month, day} for a given timezone
 * @param {AbortSignal} [abortSignal] - Optional abort signal to cancel the scan
 * @returns {Promise<Array<{ city: Object, milestone: Object }>>}
 */
export const scanCitiesForMilestones = async (getDateParts, abortSignal) => {
  const cities = shuffle(MAJOR_CITIES);
  const results = [];

  for (let i = 0; i < cities.length; i += 1) {
    if (abortSignal?.aborted) break;

    if (i > 0 && i % YIELD_EVERY === 0) {
      await yieldToMain();
    }

    if (abortSignal?.aborted) break;

    const result = hasMilestoneToday(cities[i], getDateParts);
    if (result) {
      results.push(result);
      if (results.length >= MAX_MILESTONE_CITIES) break;
    }
  }

  return results;
};
