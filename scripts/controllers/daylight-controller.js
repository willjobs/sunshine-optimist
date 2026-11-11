/**
 * Daylight Calculations Controller
 *
 * Handles sun metrics calculations, delta comparisons, message data building,
 * milestone management, and UI updates for daylight statistics.
 */

import {
  addDaysToDateParts,
  addMonthsToDateParts,
  compareDateParts,
  getDaysBetweenDateParts,
  getDaysInMonth,
  getDaysInYear,
  getAdjustedMonth,
  getLocalNoonDateFromParts,
  getMinutesSinceMidnight,
} from "../utils/date-utils.js";
import { setText } from "../utils/dom-utils.js";
import { createAstronomyContext } from "../utils/astronomy-utils.js";
import {
  DAYLIGHT_DURATION_MILESTONES,
  DAYLIGHT_GAIN_MILESTONES,
  SUNRISE_THRESHOLD_MILESTONES,
  SUNSET_THRESHOLD_MILESTONES,
} from "../milestones.js";
import {
  getSeasonalContextAsync,
  getDaylightAfter5pm,
  getRateFacts,
  daysUntil,
} from "../services/seasonal-insights-service.js";
import { clampValue } from "../utils/utils.js";
import {
  formatDuration,
  formatDeltaStatement,
  formatComparisonTooltip,
  formatMinutesValue,
} from "../formatters/formatters.js";
import { updateDeltaTooltip } from "../ui/tooltip-ui.js";
import {
  updateMilestoneCard,
  getMilestoneTodayCopy,
  celebrateMilestone,
} from "../ui/milestone-ui.js";
import { stopOptimisticRotation, setOptimisticCopy } from "../ui/message-ui.js";
import { updateShareSnapshot } from "../ui/share-modal-ui.js";

/**
 * Calculate sun metrics for today and comparison periods.
 * Returns raw data needed for delta calculations and UI updates.
 * Uses async yearly extremes calculation to avoid blocking the main thread.
 */
export const calculateSunMetrics = async (astronomy, todayParts) => {
  const weekParts = addDaysToDateParts(todayParts, -7);
  const monthParts = addMonthsToDateParts(todayParts, -1);

  const todayEvents = astronomy.getSunEvents(todayParts);
  const weekEvents = astronomy.getSunEvents(weekParts);
  const monthEvents = astronomy.getSunEvents(monthParts);

  const todaySunsetMinutes = astronomy.getSunsetMinutesForDateParts(todayParts);
  const weekSunsetMinutes = astronomy.getSunsetMinutesForDateParts(weekParts);
  const monthSunsetMinutes = astronomy.getSunsetMinutesForDateParts(monthParts);

  const todayDaylight = astronomy.getDaylightMinutesForDateParts(todayParts);
  const weekDaylight = astronomy.getDaylightMinutesForDateParts(weekParts);
  const monthDaylight = astronomy.getDaylightMinutesForDateParts(monthParts);

  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterdayDaylight = astronomy.getDaylightMinutesForDateParts(yesterdayParts);
  const yesterdaySunsetMinutes = astronomy.getSunsetMinutesForDateParts(yesterdayParts);

  const yearlyExtremes = await astronomy.getYearlySunExtremesAsync(todayParts.year, todayDaylight);

  return {
    todayParts,
    weekParts,
    monthParts,
    todayEvents,
    weekEvents,
    monthEvents,
    todaySunsetMinutes,
    weekSunsetMinutes,
    monthSunsetMinutes,
    todayDaylight,
    weekDaylight,
    monthDaylight,
    yesterdayDaylight,
    yesterdaySunsetMinutes,
    referenceYear: todayParts.year,
    yearlyExtremes,
  };
};

/**
 * Calculate all delta values comparing today to past periods and yearly extremes.
 * Also determines the comparison mode (week vs month vs none).
 */
export const calculateDeltas = (metrics) => {
  const {
    todaySunsetMinutes,
    weekSunsetMinutes,
    monthSunsetMinutes,
    todayDaylight,
    weekDaylight,
    monthDaylight,
    yesterdayDaylight,
    yesterdaySunsetMinutes,
    yearlyExtremes,
  } = metrics;

  const { earliestSunsetMinutes, shortestDayMinutes, longestDayMinutes } = yearlyExtremes;

  const sunsetEarliestDelta =
    todaySunsetMinutes !== null && earliestSunsetMinutes !== null
      ? todaySunsetMinutes - earliestSunsetMinutes
      : null;
  const sunsetWeekDelta =
    todaySunsetMinutes !== null && weekSunsetMinutes !== null
      ? todaySunsetMinutes - weekSunsetMinutes
      : null;
  const sunsetMonthDelta =
    todaySunsetMinutes !== null && monthSunsetMinutes !== null
      ? todaySunsetMinutes - monthSunsetMinutes
      : null;
  const daylightShortestDelta =
    todayDaylight !== null && shortestDayMinutes !== null
      ? todayDaylight - shortestDayMinutes
      : null;
  const daylightWeekDelta =
    todayDaylight !== null && weekDaylight !== null ? todayDaylight - weekDaylight : null;
  const daylightMonthDelta =
    todayDaylight !== null && monthDaylight !== null ? todayDaylight - monthDaylight : null;

  const isNegativeDelta = (value) => Number.isFinite(value) && value < 0;
  const monthHasNegative = isNegativeDelta(sunsetMonthDelta) || isNegativeDelta(daylightMonthDelta);
  const weekHasNegative = isNegativeDelta(sunsetWeekDelta) || isNegativeDelta(daylightWeekDelta);
  const comparisonMode = monthHasNegative ? (weekHasNegative ? "none" : "week") : "month";

  const sunsetComparisonDelta = comparisonMode === "week" ? sunsetWeekDelta : sunsetMonthDelta;
  const daylightComparisonDelta =
    comparisonMode === "week" ? daylightWeekDelta : daylightMonthDelta;

  // Calculate day-over-day gains (today vs yesterday)
  const daylightGainToday =
    todayDaylight !== null && yesterdayDaylight !== null ? todayDaylight - yesterdayDaylight : null;
  const sunsetGainToday =
    todaySunsetMinutes !== null && yesterdaySunsetMinutes !== null
      ? todaySunsetMinutes - yesterdaySunsetMinutes
      : null;

  // Calculate fraction of annual daylight loss completed
  let fractionOfLossCompleted = null;
  if (
    todayDaylight !== null &&
    Number.isFinite(longestDayMinutes) &&
    Number.isFinite(shortestDayMinutes)
  ) {
    const totalLoss = longestDayMinutes - shortestDayMinutes;
    if (totalLoss > 0) {
      fractionOfLossCompleted = clampValue((longestDayMinutes - todayDaylight) / totalLoss, 0, 1);
    }
  }

  return {
    sunsetEarliestDelta,
    sunsetWeekDelta,
    sunsetMonthDelta,
    daylightShortestDelta,
    daylightWeekDelta,
    daylightMonthDelta,
    comparisonMode,
    sunsetComparisonDelta,
    daylightComparisonDelta,
    daylightGainToday,
    sunsetGainToday,
    fractionOfLossCompleted,
  };
};

/**
 * Format daylight duration for display, including polar states.
 */
const formatDaylightForDisplay = (todayDaylight, polarState) => {
  if (polarState === "polar-day") {
    return "24 hours";
  }
  if (polarState === "polar-night") {
    return "0 hours";
  }
  if (todayDaylight === null) {
    return "—";
  }
  return formatDuration(todayDaylight);
};

/**
 * Format a minute value for the gain badge: "14s" or "1m 13s".
 */
const formatBadgeMinutes = (minutes) => {
  const totalSeconds = Math.max(1, Math.round(minutes * 60));
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (wholeMinutes < 1) {
    return `${remainingSeconds}s`;
  }
  return `${wholeMinutes}m ${remainingSeconds}s`;
};

/**
 * Update the stats display UI with formatted delta values and tooltips.
 */
export const updateStatsUI = (
  dom,
  metrics,
  deltas,
  timeZone,
  formatters,
  polarState = "normal"
) => {
  const {
    todayEvents,
    weekEvents,
    monthEvents,
    weekParts,
    monthParts,
    todayDaylight,
    referenceYear,
    yearlyExtremes,
  } = metrics;

  const {
    sunsetEarliestDelta,
    daylightShortestDelta,
    comparisonMode,
    sunsetComparisonDelta,
    daylightComparisonDelta,
  } = deltas;

  const { formatTime, formatTimeFromMinutes, formatShortDateFromParts } = formatters;

  const {
    earliestSunsetMinutes,
    earliestSunsetDateParts,
    shortestDayMinutes,
    shortestDayDateParts,
  } = yearlyExtremes;

  const showComparison = comparisonMode !== "none";
  const comparisonReference = comparisonMode === "week" ? "1 week ago" : "1 month ago";

  // Format delta text
  const sunsetEarliestText = formatDeltaStatement(sunsetEarliestDelta, "later", "earlier");
  const daylightShortestText = formatDeltaStatement(daylightShortestDelta, "longer", "shorter");
  const sunsetComparisonText = showComparison
    ? formatDeltaStatement(sunsetComparisonDelta, "later", "earlier")
    : "";
  const daylightComparisonText = showComparison
    ? formatDeltaStatement(daylightComparisonDelta, "longer", "shorter")
    : "";

  // Update sunset time
  setText(
    dom.sunsetTimeValue,
    todayEvents.sunset ? formatTime(todayEvents.sunset.date, timeZone) : "—"
  );

  // Update delta values
  setText(dom.sunsetEarliestDeltaValue, sunsetEarliestText);
  setText(dom.daylightDurationValue, formatDaylightForDisplay(todayDaylight, polarState));
  setText(dom.daylightShortestDeltaValue, daylightShortestText);

  // Toggle row visibility
  if (dom.sunsetEarliestRow) {
    dom.sunsetEarliestRow.classList.toggle("is-hidden", !sunsetEarliestText);
  }
  if (dom.daylightShortestRow) {
    dom.daylightShortestRow.classList.toggle("is-hidden", !daylightShortestText);
  }

  const showSunsetComparison = Boolean(sunsetComparisonText);
  const showDaylightComparison = Boolean(daylightComparisonText);

  if (dom.sunsetComparisonRow) {
    dom.sunsetComparisonRow.classList.toggle("is-hidden", !showSunsetComparison);
  }
  if (dom.daylightComparisonRow) {
    dom.daylightComparisonRow.classList.toggle("is-hidden", !showDaylightComparison);
  }

  // Update comparison references and values
  setText(dom.sunsetComparisonReference, showSunsetComparison ? comparisonReference : "");
  setText(dom.daylightComparisonReference, showDaylightComparison ? comparisonReference : "");
  setText(dom.sunsetComparisonDeltaValue, sunsetComparisonText);
  setText(dom.daylightComparisonDeltaValue, daylightComparisonText);

  // Build and update tooltips
  const sunsetEarliestTooltip =
    earliestSunsetMinutes !== null && earliestSunsetDateParts
      ? formatComparisonTooltip(
          formatTimeFromMinutes(earliestSunsetMinutes, earliestSunsetDateParts, timeZone),
          earliestSunsetDateParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const sunsetWeekTooltip = weekEvents.sunset
    ? formatComparisonTooltip(
        formatTime(weekEvents.sunset.date, timeZone),
        weekParts,
        timeZone,
        referenceYear,
        formatShortDateFromParts
      )
    : "";
  const sunsetMonthTooltip = monthEvents.sunset
    ? formatComparisonTooltip(
        formatTime(monthEvents.sunset.date, timeZone),
        monthParts,
        timeZone,
        referenceYear,
        formatShortDateFromParts
      )
    : "";
  const sunsetComparisonTooltip =
    comparisonMode === "week" ? sunsetWeekTooltip : sunsetMonthTooltip;

  updateDeltaTooltip(dom.sunsetEarliestReference, sunsetEarliestText ? sunsetEarliestTooltip : "");
  updateDeltaTooltip(
    dom.sunsetComparisonReference,
    showSunsetComparison ? sunsetComparisonTooltip : ""
  );

  const daylightShortestTooltip =
    shortestDayMinutes !== null && shortestDayDateParts
      ? formatComparisonTooltip(
          formatDuration(shortestDayMinutes),
          shortestDayDateParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightWeekTooltip =
    metrics.weekDaylight !== null
      ? formatComparisonTooltip(
          formatDuration(metrics.weekDaylight),
          weekParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightMonthTooltip =
    metrics.monthDaylight !== null
      ? formatComparisonTooltip(
          formatDuration(metrics.monthDaylight),
          monthParts,
          timeZone,
          referenceYear,
          formatShortDateFromParts
        )
      : "";
  const daylightComparisonTooltip =
    comparisonMode === "week" ? daylightWeekTooltip : daylightMonthTooltip;

  updateDeltaTooltip(
    dom.daylightShortestReference,
    daylightShortestText ? daylightShortestTooltip : ""
  );
  updateDeltaTooltip(
    dom.daylightComparisonReference,
    showDaylightComparison ? daylightComparisonTooltip : ""
  );

  // Update gain badges (day-over-day: today vs yesterday)
  if (dom.sunsetGainBadge) {
    const sunsetGainToday = deltas.sunsetGainToday;
    const showSunsetBadge = Number.isFinite(sunsetGainToday) && sunsetGainToday > 0;
    const badgeText = showSunsetBadge
      ? `+${formatBadgeMinutes(sunsetGainToday)} since yesterday`
      : "";
    setText(dom.sunsetGainBadge, badgeText);
    dom.sunsetGainBadge.classList.toggle("is-hidden", !showSunsetBadge);
  }

  if (dom.daylightGainBadge) {
    const daylightGainToday = deltas.daylightGainToday;
    const showDaylightBadge = Number.isFinite(daylightGainToday) && daylightGainToday > 0;
    const badgeText = showDaylightBadge
      ? `+${formatBadgeMinutes(daylightGainToday)} since yesterday`
      : "";
    setText(dom.daylightGainBadge, badgeText);
    dom.daylightGainBadge.classList.toggle("is-hidden", !showDaylightBadge);
  }
};

/**
 * Build the message data object used for optimistic message selection.
 * Also returns daylightGainToday needed for the share snapshot.
 * Uses async average winter daylight calculation to avoid blocking the main thread.
 */
export const buildMessageData = async (
  astronomy,
  todayParts,
  metrics,
  deltas,
  hemisphere,
  timeZone,
  formatShortDateFromParts,
  seasonal = null
) => {
  const context = seasonal || (await getSeasonalContextAsync(astronomy, todayParts, hemisphere));
  const {
    todaySunsetMinutes,
    monthSunsetMinutes,
    todayDaylight,
    weekDaylight,
    monthDaylight,
    yearlyExtremes,
  } = metrics;
  const { daylightGainToday } = deltas;
  const minimum = context.pastDaylight?.shortestDayMinutes ?? yearlyExtremes.shortestDayMinutes;
  const endOfMonthParts = {
    year: todayParts.year,
    month: todayParts.month,
    day: getDaysInMonth(todayParts.year, todayParts.month),
  };
  const beforeSummer = Boolean(
    context.nextSummer && compareDateParts(todayParts, context.nextSummer) < 0
  );
  const afterWinter = Boolean(
    context.previousWinter &&
    compareDateParts(todayParts, context.previousWinter) > 0 &&
    beforeSummer
  );
  const lengthening = afterWinter && daylightGainToday > 0;
  const sunsetSummer = context.pastSunset
    ? astronomy.getNextSeasonDateParts(context.pastSunset.winterParts, hemisphere, "summer")
    : null;
  const afterSunsetTurnaround = Boolean(
    context.pastSunset?.laterSunsetsDateParts &&
    compareDateParts(todayParts, context.pastSunset.laterSunsetsDateParts) >= 0 &&
    sunsetSummer &&
    compareDateParts(todayParts, sunsetSummer) < 0
  );
  const rates = getRateFacts(astronomy, todayParts, todayDaylight, weekDaylight);
  const winterForAverage = astronomy.getNextSeasonDateParts(todayParts, hemisphere, "winter");
  const averageWinterDaylight = await astronomy.getAverageWinterDaylightAsync(
    winterForAverage,
    hemisphere
  );
  const daylightTwin = [8, 9].includes(getAdjustedMonth(todayParts.month, hemisphere))
    ? await astronomy.findDaylightTwinAsync(todayParts, hemisphere)
    : null;
  const totalRange = yearlyExtremes.longestDayMinutes - yearlyExtremes.shortestDayMinutes;
  const fractionLoss =
    Number.isFinite(todayDaylight) && totalRange > 0
      ? clampValue((yearlyExtremes.longestDayMinutes - todayDaylight) / totalRange, 0, 1)
      : null;
  return {
    daylightGainToday,
    messageData: {
      sunset_today: todaySunsetMinutes,
      sunset_earliest: context.pastSunset?.earliestSunsetMinutes ?? null,
      sunset_start_of_year: astronomy.getSunsetMinutesForDateParts({
        year: todayParts.year,
        month: 1,
        day: 1,
      }),
      sunset_one_month_ago: monthSunsetMinutes,
      after_sunset_turnaround: Number(afterSunsetTurnaround),
      after_winter_solstice: Number(afterWinter),
      before_spring_equinox: Number(
        afterWinter && context.nextSpring && compareDateParts(todayParts, context.nextSpring) < 0
      ),
      before_summer_solstice: Number(beforeSummer && afterWinter),
      days_are_lengthening: Number(lengthening),
      daylight_minimum: minimum,
      daylight_maximum: yearlyExtremes.longestDayMinutes,
      daylight_today: todayDaylight,
      daylight_at_end_of_month: astronomy.getDaylightMinutesForDateParts(endOfMonthParts),
      days_until_month_end: getDaysBetweenDateParts(todayParts, endOfMonthParts),
      daylight_after_5pm_today: getDaylightAfter5pm(metrics.todayEvents, todayParts, timeZone),
      daylight_one_month_ago: monthDaylight,
      daylight_in_14_days: astronomy.getDaylightMinutesForDateParts(
        addDaysToDateParts(todayParts, 14)
      ),
      daylight_gain_this_week: rates.weeklyGain,
      gains_are_accelerating: Number(rates.gainsAccelerating),
      daylight_loss_slowdown_percent: rates.lossSlowdownPercent,
      daylight_gain_today: daylightGainToday,
      fraction_of_loss_completed: fractionLoss,
      days_until_max_daily_gain: daysUntil(
        todayParts,
        context.fastestGainDate || yearlyExtremes.maxDailyGainDateParts
      ),
      days_until_longer_days: daysUntil(todayParts, context.nextLongerDays),
      days_until_later_sunsets: daysUntil(todayParts, context.nextLaterSunsets),
      days_since_shortest_day: context.pastDaylight
        ? getDaysBetweenDateParts(context.pastDaylight.shortestDayDateParts, todayParts)
        : null,
      weeks_with_sunset_after_7pm_remaining:
        todaySunsetMinutes !== null ? astronomy.getWeeksWithSunsetAfter(todayParts, 19 * 60) : null,
      days_with_less_daylight: yearlyExtremes.daysWithLessDaylight,
      days_in_year: getDaysInYear(todayParts.year),
      is_in_brightest_70_days: Number(context.isBrightest),
      average_winter_daylight: averageWinterDaylight,
      today_date: getLocalNoonDateFromParts(todayParts, timeZone),
      daylight_twin_date: daylightTwin
        ? formatShortDateFromParts(daylightTwin, timeZone, todayParts.year, "long")
        : null,
    },
  };
};

/**
 * Build a milestone object
 */
const buildMilestone = ({ dateParts, ...copy }) => {
  if (!dateParts) return null;
  return { ...copy, dateParts };
};

/**
 * Add offset days to a milestone
 */
const withMilestoneOffset = (milestoneItem, todayParts) => {
  if (!milestoneItem || !todayParts) return null;
  const offsetDays = getDaysBetweenDateParts(todayParts, milestoneItem.dateParts);
  if (!Number.isFinite(offsetDays)) return null;
  return { ...milestoneItem, offsetDays };
};

export const getUpcomingSunriseThresholdsAsync = async (astronomy, todayParts, hemisphere) => {
  const targets = SUNRISE_THRESHOLD_MILESTONES.map(({ minutes }) => minutes);
  const previousWinter = astronomy.getPreviousSeasonDateParts(todayParts, hemisphere, "winter");
  if (!previousWinter) {
    return new Map();
  }
  const currentSummer = astronomy.getNextSeasonDateParts(previousWinter, hemisphere, "summer");
  const current = await astronomy.findStableSunriseThresholdsAsync(
    previousWinter,
    currentSummer,
    targets
  );
  const upcoming = new Map(
    [...current].filter(([, dateParts]) => compareDateParts(dateParts, todayParts) >= 0)
  );
  const missingTargets = targets.filter((target) => !upcoming.has(target));
  if (!missingTargets.length) {
    return upcoming;
  }

  const nextWinter = astronomy.getNextSeasonDateParts(todayParts, hemisphere, "winter");
  if (!nextWinter || compareDateParts(nextWinter, previousWinter) <= 0) {
    return upcoming;
  }
  const nextSummer = astronomy.getNextSeasonDateParts(nextWinter, hemisphere, "summer");
  const next = await astronomy.findStableSunriseThresholdsAsync(
    nextWinter,
    nextSummer,
    missingTargets
  );
  for (const [target, dateParts] of next) {
    upcoming.set(target, dateParts);
  }
  return upcoming;
};

export const getUpcomingLatestSunriseAsync = async (astronomy, todayParts, hemisphere) => {
  const previousWinter = astronomy.getPreviousSeasonDateParts(todayParts, hemisphere, "winter");
  if (!previousWinter) {
    return null;
  }
  const current = await astronomy.findLatestSunrisePassedAsync(previousWinter);
  if (current && compareDateParts(current, todayParts) >= 0) {
    return current;
  }
  const nextWinter = astronomy.getNextSeasonDateParts(todayParts, hemisphere, "winter");
  if (!nextWinter || compareDateParts(nextWinter, previousWinter) <= 0) {
    return null;
  }
  return astronomy.findLatestSunrisePassedAsync(nextWinter);
};

export const getUpcomingFastestGainAsync = async (astronomy, todayParts, yearlyExtremes) => {
  const currentDate = yearlyExtremes.maxDailyGainDateParts;
  if (
    yearlyExtremes.maxDailyGainMinutes > 0 &&
    currentDate &&
    compareDateParts(currentDate, todayParts) >= 0
  ) {
    return currentDate;
  }
  const nextYear = await astronomy.getYearlySunExtremesAsync(todayParts.year + 1, null);
  return nextYear.maxDailyGainMinutes > 0 ? nextYear.maxDailyGainDateParts : null;
};

/**
 * Build milestone candidates and filter to upcoming milestones.
 * Returns todayMilestone (if any) and sorted upcoming milestones.
 */
export const buildUpcomingMilestones = (
  astronomy,
  todayParts,
  metrics,
  hemisphere,
  timeZone,
  formatTimeFromMinutes,
  polarState = "normal",
  sunriseThresholdDates = new Map(),
  latestSunrisePassedDate = null,
  fastestGainDate = null,
  seasonal = {}
) => {
  const candidates = [];
  const add = (config) => {
    const item = buildMilestone(config);
    if (item) candidates.push(item);
  };
  const at14 = addDaysToDateParts(todayParts, 14);
  const daylightNow = metrics.todayDaylight;
  const daylightThen = astronomy.getDaylightMinutesForDateParts?.(at14);
  const positiveOutlook = (value, template) =>
    Number.isFinite(value) && value >= 0.5 ? template(formatMinutesValue(value)) : null;
  const sunsetThen = astronomy.getSunsetMinutesForDateParts?.(at14);
  const sunriseNow = astronomy.getSunEvents(todayParts).sunrise;
  const sunriseThen = astronomy.getSunEvents(at14).sunrise;
  const sunriseGain =
    sunriseNow && sunriseThen
      ? getMinutesSinceMidnight(sunriseNow.date, timeZone) -
        getMinutesSinceMidnight(sunriseThen.date, timeZone)
      : null;
  const upcomingSeasonDate = (key) =>
    (seasonal.seasons || [])
      .map((season) => season[key])
      .filter((date) => date && compareDateParts(date, todayParts) >= 0)
      .sort(compareDateParts)[0] || null;

  // Turnarounds take priority over other celebrations sharing their date.
  add({
    id: "earliest-sunset",
    title: "Later sunsets begin",
    countdownTitle: "sunsets start getting later again",
    dateParts: upcomingSeasonDate("laterSunsetsDateParts"),
    priority: 100,
    todayHeadline: "Sunsets are getting later again!",
    todayLede: positiveOutlook(
      Number.isFinite(sunsetThen) && Number.isFinite(metrics.todaySunsetMinutes)
        ? sunsetThen - metrics.todaySunsetMinutes
        : null,
      (value) => `In two weeks, sunset will be ${value} later.`
    ),
  });
  add({
    id: "shortest-day",
    title: "Longer days begin",
    countdownTitle: "days start getting longer again",
    dateParts: upcomingSeasonDate("longerDaysDateParts"),
    priority: 90,
    todayHeadline: "Days start getting longer today.",
    todayLede: positiveOutlook(
      Number.isFinite(daylightNow) && Number.isFinite(daylightThen)
        ? daylightThen - daylightNow
        : null,
      (value) => `In two weeks, you'll have ${value} more daylight.`
    ),
  });
  add({
    id: "latest-sunrise-passed",
    title: "Earlier sunrises begin",
    countdownTitle: "sunrises start getting earlier",
    dateParts: latestSunrisePassedDate,
    priority: 80,
    todayHeadline: "Sunrise starts getting earlier today.",
    todayLede: positiveOutlook(
      sunriseGain,
      (value) => `In two weeks, sunrise will be ${value} earlier.`
    ),
  });
  for (const config of SUNRISE_THRESHOLD_MILESTONES)
    add({ ...config, dateParts: sunriseThresholdDates.get(config.minutes) });
  const peakGain = fastestGainDate
    ? astronomy.getDaylightMinutesForDateParts?.(fastestGainDate) -
      astronomy.getDaylightMinutesForDateParts?.(addDaysToDateParts(fastestGainDate, -1))
    : null;
  if (peakGain >= 1)
    add({
      id: "fastest-daylight-gain",
      title: "Biggest daylight gain",
      countdownTitle: "the largest increase in daylight",
      dateParts: fastestGainDate,
      todayHeadline: `Today adds ${formatMinutesValue(peakGain)} of daylight—the year's biggest daily gain.`,
      todayLede: "Enjoy the extra light!",
    });

  const yesterday = addDaysToDateParts(todayParts, -1);
  const events = astronomy.getSunEvents(todayParts);
  const yesterdayEvents = astronomy.getSunEvents(yesterday);
  const previousPolarState = astronomy.getPolarState?.(yesterday);
  const firstSunriseToday =
    Boolean(events.sunrise) &&
    !yesterdayEvents.sunrise &&
    (!previousPolarState || previousPolarState === "polar-night");
  const firstSunsetToday =
    Boolean(events.sunset) &&
    !yesterdayEvents.sunset &&
    (!previousPolarState || previousPolarState === "polar-day");
  if (polarState === "polar-night" || firstSunriseToday)
    add({
      id: "first-sunrise",
      title: "Sunrise returns",
      countdownTitle: "sunrise returns",
      priority: 110,
      dateParts: firstSunriseToday ? todayParts : astronomy.findFirstSunrise(todayParts)?.dateParts,
      todayHeadline: Number.isFinite(daylightNow)
        ? `The sun returns today, bringing ${formatMinutesValue(daylightNow)} of daylight.`
        : "The sun returns today!",
      todayLede: "Welcome back, sunshine.",
    });
  if (polarState === "polar-day" || firstSunsetToday)
    add({
      id: "first-sunset",
      title: "First sunset after midnight sun",
      informationalOnly: true,
      dateParts: firstSunsetToday ? todayParts : astronomy.findFirstSunset(todayParts)?.dateParts,
    });

  const nextExtreme = (key) => {
    const date = metrics.yearlyExtremes[key];
    return date && compareDateParts(date, todayParts) >= 0
      ? date
      : astronomy.getYearlySunExtremes(todayParts.year + 1, null)[key];
  };
  const nextSummerSolstice = astronomy.getNextSeasonDateParts(todayParts, hemisphere, "summer");
  const longestDayParts =
    nextSummerSolstice && astronomy.getPolarState?.(nextSummerSolstice) === "polar-day"
      ? nextSummerSolstice
      : nextExtreme("longestDayDateParts");
  const longestDaylight = polarState === "polar-day" ? 1440 : daylightNow;
  add({
    id: "longest-day",
    title: "Longest day of the year",
    countdownTitle: "the longest day of the year",
    dateParts: longestDayParts,
    todayHeadline: Number.isFinite(longestDaylight)
      ? `Enjoy ${formatMinutesValue(longestDaylight)} of daylight today!`
      : "Enjoy the daylight today!",
    todayLede: "Soak up the sunshine.",
  });
  add({
    id: "spring-equinox",
    title: "Spring begins",
    countdownTitle: "spring begins",
    dateParts: astronomy.getNextSeasonDateParts(todayParts, hemisphere, "spring"),
    todayHeadline: Number.isFinite(daylightNow)
      ? `Spring begins today, with ${formatMinutesValue(daylightNow)} of daylight.`
      : "Spring begins today!",
    todayLede: null,
  });
  add({
    id: "dst-start",
    title: "Daylight saving time starts",
    countdownTitle: "daylight saving time starts",
    dateParts: astronomy.findNextDaylightSavingsStart(todayParts),
    todayHeadline: "Daylight Saving Time starts today.",
    todayLede: "Don't forget to spring forward.",
  });

  // Scan both adjacent winters so thresholds reached before a solstice and those
  // in the next brightening season are both discoverable.
  const fallbackWinter = astronomy.getPreviousSeasonDateParts(todayParts, hemisphere, "winter");
  const seasons = seasonal.seasons || [
    { earliestSunsetDateParts: fallbackWinter, shortestDayDateParts: fallbackWinter },
  ];
  const seasonalMatch = (finder, baselineKey, minutes) => {
    const matches = seasons.flatMap((season) => {
      const baseline = season[baselineKey];
      if (!baseline) return [];
      const match = finder(baseline, minutes);
      const summer = astronomy.getNextSeasonDateParts(
        season.winterParts || baseline,
        hemisphere,
        "summer"
      );
      return match?.dateParts &&
        compareDateParts(match.dateParts, todayParts) >= 0 &&
        (!summer || compareDateParts(match.dateParts, summer) <= 0)
        ? [match.dateParts]
        : [];
    });
    return matches.sort(compareDateParts)[0] || null;
  };
  const sunsetMatches = SUNSET_THRESHOLD_MILESTONES.map((config) => ({
    ...config,
    dateParts: seasonalMatch(
      astronomy.findFirstSunsetAfter,
      "earliestSunsetDateParts",
      config.minutes
    ),
  }));
  sunsetMatches.forEach(add);
  if (Number.isFinite(metrics.todaySunsetMinutes)) {
    const previousSunset = astronomy.getSunsetMinutesForDateParts?.(yesterday);
    const targets = new Set([astronomy.getNextHalfHour(metrics.todaySunsetMinutes)]);
    if (Number.isFinite(previousSunset) && metrics.todaySunsetMinutes > previousSunset) {
      targets.add(astronomy.getNextHalfHour(previousSunset));
    }
    for (const target of targets) {
      if (target > 0) {
        const match = seasonalMatch(
          astronomy.findFirstSunsetAfter,
          "earliestSunsetDateParts",
          target
        );
        if (
          match &&
          !sunsetMatches.some(
            (m) => m.minutes === target && compareDateParts(m.dateParts, match) === 0
          )
        ) {
          const label = formatTimeFromMinutes(target, todayParts, timeZone);
          add({
            id: `next-sunset-${target}`,
            title: `Sunset after ${label}`,
            countdownTitle: `sunset is after ${label}`,
            dateParts: match,
            todayHeadline: `Sunset is now after ${label}!`,
            todayLede: "Enjoy the evening light!",
          });
        }
      }
    }
  }
  for (const config of [
    ...DAYLIGHT_DURATION_MILESTONES,
    {
      id: "first-12-hours",
      title: "12+ hours of daylight",
      minutes: 720,
      countdownTitle: "days reach 12 hours of daylight",
      todayHeadline: "Today brings at least 12 hours of daylight.",
      todayLede: "Enjoy the longer days!",
    },
  ])
    add({
      ...config,
      dateParts: seasonalMatch(
        astronomy.findFirstDaylightAtLeast,
        "shortestDayDateParts",
        config.minutes
      ),
    });
  for (const config of DAYLIGHT_GAIN_MILESTONES)
    add({
      ...config,
      dateParts: seasonalMatch(
        astronomy.findFirstDaylightGain,
        "shortestDayDateParts",
        config.minutes
      ),
    });
  add({
    id: "darkest-weeks-finished",
    title: "10 darkest weeks behind you",
    countdownTitle: "the 10 darkest weeks are behind you",
    dateParts: seasonal.darkestWeeksFinished,
    todayHeadline: "The 10 darkest weeks are behind you!",
    todayLede: "Enjoy the returning light.",
  });

  const offsets = candidates.map((item) => withMilestoneOffset(item, todayParts)).filter(Boolean);
  const todayMilestone = offsets
    .filter((item) => item.offsetDays === 0 && !item.informationalOnly)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  const upcoming = offsets
    .filter((item) => item.offsetDays > 0 || (item.informationalOnly && item.offsetDays === 0))
    .sort((a, b) => a.offsetDays - b.offsetDays || a.title.localeCompare(b.title));
  return { todayMilestone, upcoming };
};

let updateGeneration = 0;

/** @internal Reset generation counter for testing */
export const _resetUpdateGeneration = () => {
  updateGeneration = 0;
};

/**
 * Main function to update daylight information for a location.
 * Uses async operations to avoid blocking the main thread during heavy calculations.
 * Includes a generation counter to discard stale results from superseded calls.
 */
export const updateDaylightForLocation = async ({
  location,
  dom,
  getActiveDateParts,
  syncDatePicker,
  updateOptimisticMessage,
  formatters,
  fallbackTimeZone,
}) => {
  if (!window.Astronomy || !location) return;

  updateGeneration += 1;
  const thisGeneration = updateGeneration;
  updateShareSnapshot(null);
  if (dom.shareButton) dom.shareButton.disabled = true;
  stopOptimisticRotation(dom.headline, dom.lede, {
    container: dom.optimisticMessage,
    dots: dom.optimisticDots,
    prevButton: dom.optimisticPrev,
    nextButton: dom.optimisticNext,
  });

  const timeZone = location.timezone || fallbackTimeZone;
  const hemisphere = location.latitude < 0 ? "south" : "north";
  const astronomy = createAstronomyContext(location, timeZone);
  const todayParts = getActiveDateParts(timeZone);
  syncDatePicker(timeZone);

  // 1. Calculate all sun metrics (async to yield to main thread during full-year scan)
  const metrics = await calculateSunMetrics(astronomy, todayParts);

  // Discard stale results if a newer update has started
  if (thisGeneration !== updateGeneration) return;

  // 2. Calculate deltas and comparison mode
  const deltas = calculateDeltas(metrics);

  // 3. Determine polar state for the current day
  const polarState = astronomy.getPolarState(todayParts);

  // 4. Update stats display (with polar state for correct daylight display)
  updateStatsUI(dom, metrics, deltas, timeZone, formatters, polarState);

  // 5. Build milestones (with polar state for first sunrise/sunset milestones)
  const sunriseThresholdDates = await getUpcomingSunriseThresholdsAsync(
    astronomy,
    todayParts,
    hemisphere
  );
  if (thisGeneration !== updateGeneration) return;
  const latestSunrisePassedDate = await getUpcomingLatestSunriseAsync(
    astronomy,
    todayParts,
    hemisphere
  );
  if (thisGeneration !== updateGeneration) return;
  const fastestGainDate = await getUpcomingFastestGainAsync(
    astronomy,
    todayParts,
    metrics.yearlyExtremes
  );
  if (thisGeneration !== updateGeneration) return;
  const seasonal = await getSeasonalContextAsync(astronomy, todayParts, hemisphere);
  if (thisGeneration !== updateGeneration) return;
  seasonal.fastestGainDate = fastestGainDate;
  const { todayMilestone, upcoming } = buildUpcomingMilestones(
    astronomy,
    todayParts,
    metrics,
    hemisphere,
    timeZone,
    formatters.formatTimeFromMinutes,
    polarState,
    sunriseThresholdDates,
    latestSunrisePassedDate,
    fastestGainDate,
    seasonal
  );
  const optimisticControls = {
    container: dom.optimisticMessage,
    dots: dom.optimisticDots,
    prevButton: dom.optimisticPrev,
    nextButton: dom.optimisticNext,
  };

  // 6. Calculate days until first sunrise (for polar night message)
  let daysUntilFirstSunrise = null;
  if (polarState === "polar-night") {
    const firstSunrise = astronomy.findFirstSunrise(todayParts);
    daysUntilFirstSunrise = firstSunrise?.offsetDays || null;
  }

  // 7. Build and display optimistic message (async to yield during winter daylight average)
  const { messageData, daylightGainToday } = await buildMessageData(
    astronomy,
    todayParts,
    metrics,
    deltas,
    hemisphere,
    timeZone,
    formatters.formatShortDateFromParts,
    seasonal
  );

  // Discard stale results if a newer update has started
  if (thisGeneration !== updateGeneration) return;

  updateOptimisticMessage({
    data: messageData,
    month: todayParts.month,
    hemisphere,
    headline: dom.headline,
    lede: dom.lede,
    controls: optimisticControls,
    getActiveDateParts,
    formatLongDateFromParts: formatters.formatLongDateFromParts,
    fallbackTimeZone,
    upcomingMilestones: upcoming,
    polarState,
    daysUntilFirstSunrise,
  });

  // 8. Handle today's milestone (overrides optimistic message)
  if (todayMilestone) {
    stopOptimisticRotation(dom.headline, dom.lede, optimisticControls);
    const todayCopy = getMilestoneTodayCopy(todayMilestone);
    if (todayCopy) {
      setOptimisticCopy(dom.headline, dom.lede, todayCopy, { animate: false });
    }
    celebrateMilestone(dom.confettiRoot, todayMilestone);
  } else {
    celebrateMilestone(dom.confettiRoot, null);
  }

  updateMilestoneCard(
    {
      nextHeadline: dom.nextHeadline,
      nextDate: dom.nextDate,
      nextAway: dom.nextAway,
      milestone: dom.milestone,
      milestoneToggle: dom.milestoneToggle,
    },
    upcoming,
    timeZone,
    formatters.formatLongDateFromParts
  );

  // 9. Update share snapshot
  const { yearlyExtremes } = metrics;
  updateShareSnapshot({
    location,
    timeZone,
    dateParts: todayParts,
    todayDaylight: metrics.todayDaylight,
    daylightGainToday,
    longestDayMinutes: yearlyExtremes.longestDayMinutes,
    shortestDayMinutes: yearlyExtremes.shortestDayMinutes,
    sunsetEarliestDelta: deltas.sunsetEarliestDelta,
    hemisphere,
    fractionOfLossCompleted: deltas.fractionOfLossCompleted,
    polarState,
  });
  if (dom.shareButton) dom.shareButton.disabled = false;
};
