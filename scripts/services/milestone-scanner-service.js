/**
 * Milestone Scanner Service
 *
 * Scans major cities to find which ones have a daylight milestone today.
 * Uses a lightweight check that short-circuits on the first matching milestone.
 */

import { createAstronomyContext } from "../utils/astronomy-utils.js";
import {
  addDaysToDateParts,
  compareDateParts,
  getDaysBetweenDateParts,
} from "../utils/date-utils.js";
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
  const today = getDateParts(city.timezone);
  const astronomy = createAstronomyContext(city, city.timezone);
  const hemisphere = city.latitude < 0 ? "south" : "north";
  const previousWinter = astronomy.getPreviousSeasonDateParts(today, hemisphere, "winter");
  if (!previousWinter) return null;
  const previousSummer = astronomy.getPreviousSeasonDateParts(today, hemisphere, "summer");
  const winter =
    compareDateParts(previousWinter, previousSummer) > 0
      ? previousWinter
      : astronomy.getNextSeasonDateParts(today, hemisphere, "winter");
  if (!winter) return null;
  const summer = astronomy.getNextSeasonDateParts(winter, hemisphere, "summer");
  if (!summer || compareDateParts(today, summer) > 0 || getDaysBetweenDateParts(today, winter) > 80)
    return null;
  const yesterday = addDaysToDateParts(today, -1);
  const sunset = astronomy.getSunsetMinutesForDateParts(today);
  const previousSunset = astronomy.getSunsetMinutesForDateParts(yesterday);
  const daylight = astronomy.getDaylightMinutesForDateParts(today);
  const previousDaylight = astronomy.getDaylightMinutesForDateParts(yesterday);
  const crossing = (value, previous, target) =>
    Number.isFinite(value) && Number.isFinite(previous) && previous < target && value >= target;
  for (const milestone of SUNSET_THRESHOLD_MILESTONES) {
    if (crossing(sunset, previousSunset, milestone.minutes)) return { city, milestone };
  }
  for (const milestone of DAYLIGHT_DURATION_MILESTONES) {
    if (crossing(daylight, previousDaylight, milestone.minutes)) return { city, milestone };
  }
  if (
    !(Number.isFinite(daylight) && Number.isFinite(previousDaylight) && daylight > previousDaylight)
  )
    return null;
  const minimum = astronomy.findWinterDaylightMinimum(winter);
  if (!minimum || compareDateParts(today, minimum.dateParts) <= 0) return null;
  for (const milestone of DAYLIGHT_GAIN_MILESTONES) {
    if (crossing(daylight - minimum.minutes, previousDaylight - minimum.minutes, milestone.minutes))
      return { city, milestone };
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

    const result = await hasMilestoneToday(cities[i], getDateParts);
    if (abortSignal?.aborted) break;
    if (result) {
      results.push(result);
      if (results.length >= MAX_MILESTONE_CITIES) break;
    }
  }

  return results;
};
