import {
  addDaysToDateParts,
  compareDateParts,
  formatDateInputValue,
  getDaysInMonth,
  getDaysInYear,
  getLocalDateParts,
  getMinutesSinceMidnight,
  getTimeZoneOffsetMinutes,
  zonedTimeToUtc,
} from "./date-utils.js";

const CHUNK_SIZE = 30;

const yieldToMain = () =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });

const MAX_CACHED_LOCATIONS = 10;
const locationCaches = new Map();

const getLocationKey = (location, timeZone) =>
  `${location.latitude},${location.longitude},${location.elevation || 0}:${timeZone}`;

const getLocationCache = (locationKey) => {
  if (locationCaches.has(locationKey)) {
    const cache = locationCaches.get(locationKey);
    locationCaches.delete(locationKey);
    locationCaches.set(locationKey, cache);
    return cache;
  }
  if (locationCaches.size >= MAX_CACHED_LOCATIONS) {
    const oldestKey = locationCaches.keys().next().value;
    locationCaches.delete(oldestKey);
  }
  const cache = {
    sunEvents: new Map(),
    yearSummary: new Map(),
    seasonParts: new Map(),
    averageWinter: new Map(),
  };
  locationCaches.set(locationKey, cache);
  return cache;
};

const getDaylightMinutes = (events) => {
  if (!events?.sunrise || !events?.sunset) {
    return null;
  }
  return (events.sunset.date - events.sunrise.date) / 60000;
};

export const createAstronomyContext = (location, timeZone) => {
  if (!globalThis.Astronomy) {
    const nullExtremes = {
      earliestSunsetMinutes: null,
      earliestSunsetDateParts: null,
      shortestDayMinutes: null,
      shortestDayDateParts: null,
      longestDayMinutes: null,
      longestDayDateParts: null,
      maxDailyGainMinutes: null,
      maxDailyGainDateParts: null,
      daysWithLessDaylight: null,
    };
    return {
      getSunEvents: () => ({ sunrise: null, sunset: null }),
      getSunsetMinutesForDateParts: () => null,
      getDaylightMinutesForDateParts: () => null,
      getYearlySunExtremes: () => nullExtremes,
      getYearlySunExtremesAsync: async () => nullExtremes,
      getSeasonDatePartsForYear: () => ({ spring: null, summer: null, autumn: null, winter: null }),
      getNextSeasonDateParts: () => null,
      getPreviousSeasonDateParts: () => null,
      getAverageWinterDaylight: () => null,
      getAverageWinterDaylightAsync: async () => null,
      getDaysUntilSunsetAfter: () => null,
      getWeeksWithSunsetAfter: () => null,
      getDaylightDailyGainThisWeekMin: () => null,
      getNextHalfHour: () => null,
      findNextSunsetThreshold: () => null,
      findNextDaylightSavingsStart: () => null,
      findFirstSunsetAfter: () => null,
      findFirstDaylightAtLeast: () => null,
      findFirstDaylightGain: () => null,
      getPolarState: () => "normal",
      findFirstSunrise: () => null,
      findFirstSunset: () => null,
    };
  }

  const locationKey = getLocationKey(location, timeZone);
  const cache = getLocationCache(locationKey);
  const observer = new Astronomy.Observer(
    location.latitude,
    location.longitude,
    location.elevation || 0
  );

  const getSunEvents = (dateParts) => {
    const key = formatDateInputValue(dateParts);
    if (!key) {
      return { sunrise: null, sunset: null };
    }
    if (cache.sunEvents.has(key)) {
      return cache.sunEvents.get(key);
    }

    const midnightUtc = zonedTimeToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      0,
      0,
      0,
      timeZone
    );

    // Search for first sunrise within the calendar day
    let sunrise = Astronomy.SearchRiseSet("Sun", observer, +1, midnightUtc, 1);

    // Validate sunrise is within this calendar day
    if (sunrise) {
      const sunriseParts = getLocalDateParts(sunrise.date, timeZone);
      if (compareDateParts(sunriseParts, dateParts) !== 0) {
        sunrise = null;
      }
    }

    let sunset = null;

    if (sunrise) {
      // Normal case: search for sunset AFTER sunrise
      sunset = Astronomy.SearchRiseSet("Sun", observer, -1, sunrise.date, 1);

      // Validate sunset is within this calendar day or the next day
      // (sunset can be after midnight in polar regions during transition)
      if (sunset) {
        const sunsetParts = getLocalDateParts(sunset.date, timeZone);
        const tomorrow = addDaysToDateParts(dateParts, 1);
        // Accept sunset if it's today or tomorrow, reject if further out
        if (
          compareDateParts(sunsetParts, dateParts) !== 0 &&
          compareDateParts(sunsetParts, tomorrow) !== 0
        ) {
          sunset = null;
        }
      }
    } else {
      // No sunrise found - could be:
      // 1. Polar night (sun never rises)
      // 2. Exiting polar day (sun was up at midnight, sets during day)

      // Try finding a sunset within the day
      sunset = Astronomy.SearchRiseSet("Sun", observer, -1, midnightUtc, 1);
      if (sunset) {
        const sunsetParts = getLocalDateParts(sunset.date, timeZone);
        if (compareDateParts(sunsetParts, dateParts) !== 0) {
          sunset = null;
        }
      }

      // If we have sunset but no sunrise, sun was up at midnight (polar day exit)
      // For simplicity, treat as incomplete day with null daylight
    }

    const events = { sunrise, sunset };
    cache.sunEvents.set(key, events);
    return events;
  };

  const getSunsetMinutesForDateParts = (dateParts) => {
    const { sunset } = getSunEvents(dateParts);
    return sunset ? getMinutesSinceMidnight(sunset.date, timeZone) : null;
  };

  const getDaylightMinutesForDateParts = (dateParts) => getDaylightMinutes(getSunEvents(dateParts));

  const buildYearSummaryCore = (year, yieldFn) => {
    if (cache.yearSummary.has(year)) {
      return cache.yearSummary.get(year);
    }
    const yearStart = { year, month: 1, day: 1 };
    const daysInYear = getDaysInYear(year);
    let earliestSunsetMinutes = null;
    let earliestSunsetDateParts = null;
    let shortestDayMinutes = null;
    let shortestDayDateParts = null;
    let longestDayMinutes = null;
    let longestDayDateParts = null;
    let maxDailyGainMinutes = null;
    let maxDailyGainDateParts = null;
    let previousDaylightMinutes = null;
    const daylightByDay = [];

    const processDay = (offset) => {
      const dateParts = addDaysToDateParts(yearStart, offset);
      const events = getSunEvents(dateParts);

      if (events.sunset) {
        const sunsetMinutes = getMinutesSinceMidnight(events.sunset.date, timeZone);
        if (earliestSunsetMinutes === null || sunsetMinutes < earliestSunsetMinutes) {
          earliestSunsetMinutes = sunsetMinutes;
          earliestSunsetDateParts = dateParts;
        }
      }

      const daylightMinutes = getDaylightMinutes(events);
      daylightByDay.push(daylightMinutes);
      if (daylightMinutes !== null) {
        if (shortestDayMinutes === null || daylightMinutes < shortestDayMinutes) {
          shortestDayMinutes = daylightMinutes;
          shortestDayDateParts = dateParts;
        }
        if (longestDayMinutes === null || daylightMinutes > longestDayMinutes) {
          longestDayMinutes = daylightMinutes;
          longestDayDateParts = dateParts;
        }
        if (previousDaylightMinutes !== null) {
          const gain = daylightMinutes - previousDaylightMinutes;
          if (maxDailyGainMinutes === null || gain > maxDailyGainMinutes) {
            maxDailyGainMinutes = gain;
            maxDailyGainDateParts = dateParts;
          }
        }
        previousDaylightMinutes = daylightMinutes;
      } else {
        previousDaylightMinutes = null;
      }
    };

    const buildSummary = () => {
      const summary = {
        earliestSunsetMinutes,
        earliestSunsetDateParts,
        shortestDayMinutes,
        shortestDayDateParts,
        longestDayMinutes,
        longestDayDateParts,
        maxDailyGainMinutes,
        maxDailyGainDateParts,
        daylightByDay,
      };
      cache.yearSummary.set(year, summary);
      return summary;
    };

    if (yieldFn) {
      return (async () => {
        for (let offset = 0; offset < daysInYear; offset += 1) {
          if (offset > 0 && offset % CHUNK_SIZE === 0) {
            await yieldFn();
          }
          processDay(offset);
        }
        return buildSummary();
      })();
    }

    for (let offset = 0; offset < daysInYear; offset += 1) {
      processDay(offset);
    }
    return buildSummary();
  };

  const buildYearSummary = (year) => buildYearSummaryCore(year, null);
  const buildYearSummaryAsync = (year) => buildYearSummaryCore(year, yieldToMain);

  const extractExtremes = (summary, todayDaylight) => {
    const { daylightByDay, ...extremes } = summary;
    let daysWithLessDaylight = null;
    if (todayDaylight !== null && Number.isFinite(todayDaylight)) {
      daysWithLessDaylight = daylightByDay.reduce((count, value) => {
        if (value === null || Number.isNaN(value)) {
          return count;
        }
        return value < todayDaylight ? count + 1 : count;
      }, 0);
    }
    return { ...extremes, daysWithLessDaylight };
  };

  const getYearlySunExtremes = (year, todayDaylight) =>
    extractExtremes(buildYearSummary(year), todayDaylight);

  const getYearlySunExtremesAsync = async (year, todayDaylight) =>
    extractExtremes(await buildYearSummaryAsync(year), todayDaylight);

  const getSeasonDatePartsForYear = (year, hemisphere) => {
    const cacheKey = `${year}-${hemisphere}`;
    if (cache.seasonParts.has(cacheKey)) {
      return cache.seasonParts.get(cacheKey);
    }
    const seasons = Astronomy.Seasons(year);
    const mapping =
      hemisphere === "south"
        ? {
            spring: seasons.sep_equinox,
            summer: seasons.dec_solstice,
            autumn: seasons.mar_equinox,
            winter: seasons.jun_solstice,
          }
        : {
            spring: seasons.mar_equinox,
            summer: seasons.jun_solstice,
            autumn: seasons.sep_equinox,
            winter: seasons.dec_solstice,
          };
    const parts = {
      spring: getLocalDateParts(mapping.spring.date, timeZone),
      summer: getLocalDateParts(mapping.summer.date, timeZone),
      autumn: getLocalDateParts(mapping.autumn.date, timeZone),
      winter: getLocalDateParts(mapping.winter.date, timeZone),
    };
    cache.seasonParts.set(cacheKey, parts);
    return parts;
  };

  const getNextSeasonDateParts = (todayParts, hemisphere, season) => {
    const currentYear = getSeasonDatePartsForYear(todayParts.year, hemisphere);
    let target = currentYear[season];
    if (compareDateParts(target, todayParts) < 0) {
      const nextYear = getSeasonDatePartsForYear(todayParts.year + 1, hemisphere);
      target = nextYear[season];
    }
    return target;
  };

  const getPreviousSeasonDateParts = (todayParts, hemisphere, season) => {
    const currentYear = getSeasonDatePartsForYear(todayParts.year, hemisphere);
    let target = currentYear[season];
    if (compareDateParts(target, todayParts) > 0) {
      const previousYear = getSeasonDatePartsForYear(todayParts.year - 1, hemisphere);
      target = previousYear[season];
    }
    return target;
  };

  const getAverageDaylightForMonthsCore = (months, yieldFn) => {
    let total = 0;
    let count = 0;

    const processDay = (year, month, day) => {
      const daylight = getDaylightMinutesForDateParts({ year, month, day });
      if (daylight !== null) {
        total += daylight;
        count += 1;
      }
    };

    if (yieldFn) {
      return (async () => {
        let processed = 0;
        for (const { year, month } of months) {
          const days = getDaysInMonth(year, month);
          for (let day = 1; day <= days; day += 1) {
            processed += 1;
            if (processed % CHUNK_SIZE === 0) {
              await yieldFn();
            }
            processDay(year, month, day);
          }
        }
        return count ? total / count : null;
      })();
    }

    months.forEach(({ year, month }) => {
      const days = getDaysInMonth(year, month);
      for (let day = 1; day <= days; day += 1) {
        processDay(year, month, day);
      }
    });
    return count ? total / count : null;
  };

  const getAverageDaylightForMonths = (months) => getAverageDaylightForMonthsCore(months, null);
  const getAverageDaylightForMonthsAsync = (months) =>
    getAverageDaylightForMonthsCore(months, yieldToMain);

  const getAverageWinterDaylightCore = (winterSolsticeParts, hemisphere, avgFn) => {
    if (!winterSolsticeParts) {
      return null;
    }
    const cacheKey = `${winterSolsticeParts.year}-${hemisphere}`;
    if (cache.averageWinter.has(cacheKey)) {
      return cache.averageWinter.get(cacheKey);
    }
    const months =
      hemisphere === "south"
        ? [
            { year: winterSolsticeParts.year, month: 6 },
            { year: winterSolsticeParts.year, month: 7 },
            { year: winterSolsticeParts.year, month: 8 },
          ]
        : [
            { year: winterSolsticeParts.year, month: 12 },
            { year: winterSolsticeParts.year + 1, month: 1 },
            { year: winterSolsticeParts.year + 1, month: 2 },
          ];
    const result = avgFn(months);
    if (result && typeof result.then === "function") {
      return result.then((average) => {
        cache.averageWinter.set(cacheKey, average);
        return average;
      });
    }
    cache.averageWinter.set(cacheKey, result);
    return result;
  };

  const getAverageWinterDaylight = (winterSolsticeParts, hemisphere) =>
    getAverageWinterDaylightCore(winterSolsticeParts, hemisphere, getAverageDaylightForMonths);
  const getAverageWinterDaylightAsync = (winterSolsticeParts, hemisphere) =>
    getAverageWinterDaylightCore(winterSolsticeParts, hemisphere, getAverageDaylightForMonthsAsync);

  const findNextSunsetThreshold = (startDateParts, targetMinutes, limitDays = 370) => {
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startDateParts, offset);
      const { sunset } = getSunEvents(dateParts);
      if (!sunset) {
        continue;
      }
      const sunsetMinutes = getMinutesSinceMidnight(sunset.date, timeZone);
      if (sunsetMinutes >= targetMinutes) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  const getDaysUntilSunsetAfter = (todayParts, todaySunsetMinutes, targetMinutes) => {
    if (todaySunsetMinutes === null) {
      return null;
    }
    if (todaySunsetMinutes >= targetMinutes) {
      return 0;
    }
    const match = findNextSunsetThreshold(todayParts, targetMinutes);
    return match ? match.offsetDays : null;
  };

  const getWeeksWithSunsetAfter = (startDateParts, targetMinutes, limitDays = 370) => {
    let days = 0;
    for (let offset = 0; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startDateParts, offset);
      const { sunset } = getSunEvents(dateParts);
      if (!sunset) {
        return null;
      }
      const sunsetMinutes = getMinutesSinceMidnight(sunset.date, timeZone);
      if (sunsetMinutes >= targetMinutes) {
        days += 1;
      } else {
        break;
      }
    }
    return days ? Math.floor(days / 7) : 0;
  };

  const getDaylightDailyGainThisWeekMin = (todayParts) => {
    let minGain = null;
    let previousDaylight = null;
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dateParts = addDaysToDateParts(todayParts, -offset);
      const daylight = getDaylightMinutesForDateParts(dateParts);
      if (daylight === null) {
        return null;
      }
      if (previousDaylight !== null) {
        const gain = daylight - previousDaylight;
        if (minGain === null || gain < minGain) {
          minGain = gain;
        }
      }
      previousDaylight = daylight;
    }
    return minGain;
  };

  const getNextHalfHour = (minutes) => {
    const next = Math.floor((minutes + 30) / 30) * 30;
    return next % (24 * 60);
  };

  const getOffsetMinutesForDateParts = (dateParts) => {
    if (!dateParts) {
      return null;
    }
    const date = zonedTimeToUtc(dateParts.year, dateParts.month, dateParts.day, 12, 0, 0, timeZone);
    return getTimeZoneOffsetMinutes(date, timeZone);
  };

  const findNextDaylightSavingsStart = (startParts, limitDays = 370) => {
    if (!timeZone || !startParts) {
      return null;
    }
    const previousDay = addDaysToDateParts(startParts, -1);
    let previousOffset = getOffsetMinutesForDateParts(previousDay);
    if (!Number.isFinite(previousOffset)) {
      return null;
    }
    for (let offset = 0; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const offsetMinutes = getOffsetMinutesForDateParts(dateParts);
      if (!Number.isFinite(offsetMinutes)) {
        return null;
      }
      if (offsetMinutes > previousOffset) {
        return dateParts;
      }
      previousOffset = offsetMinutes;
    }
    return null;
  };

  const findFirstSunsetAfter = (startParts, targetMinutes, limitDays = 370) => {
    const startSunset = getSunsetMinutesForDateParts(startParts);
    if (startSunset !== null && startSunset >= targetMinutes) {
      return null;
    }
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const sunsetMinutes = getSunsetMinutesForDateParts(dateParts);
      if (sunsetMinutes === null) {
        continue;
      }
      if (sunsetMinutes >= targetMinutes) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  const findFirstDaylightAtLeast = (startParts, targetMinutes, limitDays = 370) => {
    const startDaylight = getDaylightMinutesForDateParts(startParts);
    if (startDaylight !== null && startDaylight >= targetMinutes) {
      return null;
    }
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const daylight = getDaylightMinutesForDateParts(dateParts);
      if (daylight === null) {
        continue;
      }
      if (daylight >= targetMinutes) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  const findFirstDaylightGain = (startParts, gainMinutes, limitDays = 370) => {
    let startDaylight = getDaylightMinutesForDateParts(startParts);
    if (!Number.isFinite(startDaylight)) {
      startDaylight = 0;
    }
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const daylight = getDaylightMinutesForDateParts(dateParts);
      if (daylight === null) {
        continue;
      }
      if (daylight - startDaylight >= gainMinutes) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  /**
   * Get the polar state for a given date.
   * Returns "polar-day" if sun is up all day (midnight sun),
   * "polar-night" if sun is down all day,
   * or "normal" if there's a regular sunrise/sunset cycle.
   */
  const getPolarState = (dateParts) => {
    const events = getSunEvents(dateParts);
    if (events.sunrise || events.sunset) {
      return "normal";
    }
    // No sunrise and no sunset - check sun altitude at noon
    const noonUtc = zonedTimeToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      12,
      0,
      0,
      timeZone
    );
    const noonAstro = Astronomy.MakeTime(noonUtc);
    const equator = Astronomy.Equator("Sun", noonAstro, observer, true, false);
    const horizon = Astronomy.Horizon(noonAstro, observer, equator.ra, equator.dec, "normal");
    return horizon.altitude > 0 ? "polar-day" : "polar-night";
  };

  /**
   * Find the first day with a sunrise, searching forward from startParts.
   * Used during polar night to find when sunlight returns.
   */
  const findFirstSunrise = (startParts, limitDays = 200) => {
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const events = getSunEvents(dateParts);
      if (events.sunrise) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  /**
   * Find the first day with a sunset, searching forward from startParts.
   * Used during polar day (midnight sun) to find when sunset returns.
   */
  const findFirstSunset = (startParts, limitDays = 200) => {
    for (let offset = 1; offset <= limitDays; offset += 1) {
      const dateParts = addDaysToDateParts(startParts, offset);
      const events = getSunEvents(dateParts);
      if (events.sunset) {
        return { dateParts, offsetDays: offset };
      }
    }
    return null;
  };

  return {
    getSunEvents,
    getSunsetMinutesForDateParts,
    getDaylightMinutesForDateParts,
    getYearlySunExtremes,
    getYearlySunExtremesAsync,
    getSeasonDatePartsForYear,
    getNextSeasonDateParts,
    getPreviousSeasonDateParts,
    getAverageWinterDaylight,
    getAverageWinterDaylightAsync,
    getDaysUntilSunsetAfter,
    getWeeksWithSunsetAfter,
    getDaylightDailyGainThisWeekMin,
    getNextHalfHour,
    findNextSunsetThreshold,
    findNextDaylightSavingsStart,
    findFirstSunsetAfter,
    findFirstDaylightAtLeast,
    findFirstDaylightGain,
    getPolarState,
    findFirstSunrise,
    findFirstSunset,
  };
};
