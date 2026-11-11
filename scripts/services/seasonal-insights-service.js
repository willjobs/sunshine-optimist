import {
  addDaysToDateParts,
  compareDateParts,
  formatDateInputValue,
  getDaysBetweenDateParts,
  getMinutesSinceMidnight,
  getTimeZoneOffsetMinutes,
  zonedTimeToUtc,
} from "../utils/date-utils.js";

export const getDaylightAfter5pm = (events, todayParts, timeZone) => {
  if (!events?.sunrise || !events?.sunset) return null;
  const tomorrow = addDaysToDateParts(todayParts, 1);
  const five = zonedTimeToUtc(
    todayParts.year,
    todayParts.month,
    todayParts.day,
    17,
    0,
    0,
    timeZone
  );
  const midnight = zonedTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, timeZone);
  const start = Math.max(five.getTime(), events.sunrise.date.getTime());
  const end = Math.min(midnight.getTime(), events.sunset.date.getTime());
  return Math.max(0, (end - start) / 60000);
};

const nearest = (seasons, key, todayParts, upcoming) =>
  seasons
    .filter(
      (season) =>
        season?.[key] &&
        (upcoming
          ? compareDateParts(season[key], todayParts) >= 0
          : compareDateParts(season[key], todayParts) <= 0)
    )
    .sort((a, b) => (upcoming ? 1 : -1) * compareDateParts(a[key], b[key]))[0] || null;

// All dates are local calendar parts. Never compare host-local Date objects.
export const getSeasonalContextAsync = async (astronomy, todayParts, hemisphere) => {
  const previousWinter = astronomy.getPreviousSeasonDateParts(todayParts, hemisphere, "winter");
  const nextWinter = astronomy.getNextSeasonDateParts(todayParts, hemisphere, "winter");
  const winters = [previousWinter, nextWinter].filter(
    (winter, index, all) =>
      winter &&
      all.findIndex((other) => formatDateInputValue(other) === formatDateInputValue(winter)) ===
        index
  );
  const seasons = [];
  for (const winter of winters) {
    const insights = await astronomy.getWinterInsightsAsync(winter, hemisphere);
    if (insights) seasons.push(insights);
  }
  const brightestDates = await astronomy.getBrightestDayDatesAsync(todayParts.year);
  return {
    seasons,
    previousWinter,
    nextSpring: previousWinter
      ? astronomy.getNextSeasonDateParts(previousWinter, hemisphere, "spring")
      : null,
    nextSummer: previousWinter
      ? astronomy.getNextSeasonDateParts(previousWinter, hemisphere, "summer")
      : null,
    pastDaylight: nearest(seasons, "shortestDayDateParts", todayParts, false),
    pastSunset: nearest(seasons, "earliestSunsetDateParts", todayParts, false),
    upcomingSunset: nearest(seasons, "laterSunsetsDateParts", todayParts, true),
    nextLongerDays:
      nearest(seasons, "longerDaysDateParts", todayParts, true)?.longerDaysDateParts || null,
    nextLaterSunsets:
      nearest(seasons, "laterSunsetsDateParts", todayParts, true)?.laterSunsetsDateParts || null,
    darkestWeeksFinished:
      nearest(seasons, "darkestWeeksFinishedDateParts", todayParts, true)
        ?.darkestWeeksFinishedDateParts || null,
    isBrightest: brightestDates.includes(formatDateInputValue(todayParts)),
  };
};

export const getRateFacts = (astronomy, todayParts, todayDaylight, weekDaylight) => {
  const at = (offset) =>
    astronomy.getDaylightMinutesForDateParts(addDaysToDateParts(todayParts, offset));
  const twoWeeksAgo = at(-14);
  const fourWeeksAgo = at(-28);
  const fiveWeeksAgo = at(-35);
  const gain =
    Number.isFinite(todayDaylight) && Number.isFinite(weekDaylight)
      ? todayDaylight - weekDaylight
      : null;
  const previousGain =
    Number.isFinite(weekDaylight) && Number.isFinite(twoWeeksAgo)
      ? weekDaylight - twoWeeksAgo
      : null;
  const oldLoss =
    Number.isFinite(fiveWeeksAgo) && Number.isFinite(fourWeeksAgo)
      ? fiveWeeksAgo - fourWeeksAgo
      : null;
  const loss = Number.isFinite(gain) ? -gain : null;
  return {
    weeklyGain: gain,
    gainsAccelerating: gain > 0 && previousGain > 0 && gain > previousGain,
    lossSlowdownPercent: loss > 0 && oldLoss > 0 ? (1 - loss / oldLoss) * 100 : null,
  };
};

export const daysUntil = (todayParts, target) =>
  target ? getDaysBetweenDateParts(todayParts, target) : null;

/** Remaining evening-clock shift to this winter's minimum, only while sunsets fall. */
export const getSunsetMinutesLeftToLose = (astronomy, todayParts, timeZone, season) => {
  const minimum = season?.earliestSunsetDateParts;
  const turnaround = season?.laterSunsetsDateParts;
  if (
    !minimum ||
    !turnaround ||
    compareDateParts(todayParts, minimum) > 0 ||
    compareDateParts(todayParts, turnaround) >= 0
  )
    return null;
  const sunsetAt = (parts) => {
    const events = astronomy.getSunEvents(parts);
    return events.sunrise && events.sunset ? events.sunset.date : null;
  };
  const today = sunsetAt(todayParts);
  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterday = sunsetAt(yesterdayParts);
  const earliest = sunsetAt(minimum);
  if (!today || !yesterday || !earliest) return null;
  const clockMinutes = (date) =>
    getMinutesSinceMidnight(date, timeZone) + date.getUTCMilliseconds() / 60000;
  const gap = clockMinutes(today) - clockMinutes(earliest);
  if (!(gap > 0 && gap < 20) || clockMinutes(today) >= clockMinutes(yesterday)) return null;
  const offset = getTimeZoneOffsetMinutes(today, timeZone);
  // These events are already cached by the seasonal/year scans. Check the whole
  // interval so an intervening clock change cannot masquerade as evening loss.
  const count = getDaysBetweenDateParts(yesterdayParts, minimum);
  for (let day = 0; day <= count; day += 1) {
    const sunset = sunsetAt(addDaysToDateParts(yesterdayParts, day));
    if (!sunset || getTimeZoneOffsetMinutes(sunset, timeZone) !== offset) return null;
  }
  return gap;
};
