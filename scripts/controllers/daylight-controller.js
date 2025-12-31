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
  getLocalNoonDateFromParts,
  getMinutesSinceMidnight,
} from "../utils/date-utils.js";
import { setText } from "../utils/dom-utils.js";
import { createAstronomyContext } from "../utils/astronomy-utils.js";
import {
  DAYLIGHT_DURATION_MILESTONES,
  DAYLIGHT_GAIN_MILESTONES,
  SUNSET_THRESHOLD_MILESTONES,
} from "../milestones.js";
import { clampValue } from "../utils/utils.js";
import {
  formatDuration,
  formatDeltaStatement,
  formatComparisonTooltip,
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
export const calculateSunMetrics = async (astronomy, todayParts, timeZone) => {
  const weekParts = addDaysToDateParts(todayParts, -7);
  const monthParts = addMonthsToDateParts(todayParts, -1);

  const todayEvents = astronomy.getSunEvents(todayParts);
  const weekEvents = astronomy.getSunEvents(weekParts);
  const monthEvents = astronomy.getSunEvents(monthParts);

  const todaySunsetMinutes = todayEvents.sunset
    ? getMinutesSinceMidnight(todayEvents.sunset.date, timeZone)
    : null;
  const weekSunsetMinutes = weekEvents.sunset
    ? getMinutesSinceMidnight(weekEvents.sunset.date, timeZone)
    : null;
  const monthSunsetMinutes = monthEvents.sunset
    ? getMinutesSinceMidnight(monthEvents.sunset.date, timeZone)
    : null;

  const todayDaylight = astronomy.getDaylightMinutesForDateParts(todayParts);
  const weekDaylight = astronomy.getDaylightMinutesForDateParts(weekParts);
  const monthDaylight = astronomy.getDaylightMinutesForDateParts(monthParts);

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
    fractionOfLossCompleted,
  };
};

/**
 * Update the stats display UI with formatted delta values and tooltips.
 */
export const updateStatsUI = (dom, metrics, deltas, timeZone, formatters) => {
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
  setText(dom.daylightDurationValue, todayDaylight === null ? "—" : formatDuration(todayDaylight));
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
  _formatTimeFromMinutes
) => {
  const {
    todaySunsetMinutes,
    monthSunsetMinutes,
    todayDaylight,
    weekDaylight,
    monthDaylight,
    yearlyExtremes,
  } = metrics;

  const { fractionOfLossCompleted } = deltas;

  const {
    earliestSunsetMinutes,
    earliestSunsetDateParts,
    shortestDayMinutes,
    longestDayMinutes,
    maxDailyGainDateParts,
    daysWithLessDaylight,
  } = yearlyExtremes;

  // Calculate additional data points for messages
  const startOfYearParts = { year: todayParts.year, month: 1, day: 1 };
  const sunsetStartOfYear = astronomy.getSunsetMinutesForDateParts(startOfYearParts);
  const twoMonthsParts = addMonthsToDateParts(todayParts, -2);
  const twoMonthsDaylight = astronomy.getDaylightMinutesForDateParts(twoMonthsParts);
  const endOfMonthParts = {
    year: todayParts.year,
    month: todayParts.month,
    day: getDaysInMonth(todayParts.year, todayParts.month),
  };
  const daylightAtEndOfMonth = astronomy.getDaylightMinutesForDateParts(endOfMonthParts);
  const in14Parts = addDaysToDateParts(todayParts, 14);
  const daylightIn14Days = astronomy.getDaylightMinutesForDateParts(in14Parts);
  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterdayDaylight = astronomy.getDaylightMinutesForDateParts(yesterdayParts);

  const daylightGainToday =
    todayDaylight !== null && yesterdayDaylight !== null ? todayDaylight - yesterdayDaylight : null;
  const daylightGainThisWeek =
    todayDaylight !== null && weekDaylight !== null ? todayDaylight - weekDaylight : null;
  const daylightLossThisWeek =
    todayDaylight !== null && weekDaylight !== null ? weekDaylight - todayDaylight : null;
  const daylightLossThisMonthRaw =
    monthDaylight !== null && todayDaylight !== null ? monthDaylight - todayDaylight : null;
  const daylightLossThisMonth =
    daylightLossThisMonthRaw !== null && daylightLossThisMonthRaw > 0
      ? daylightLossThisMonthRaw
      : null;
  const daylightLossLastMonthRaw =
    twoMonthsDaylight !== null && monthDaylight !== null ? twoMonthsDaylight - monthDaylight : null;
  const daylightLossLastMonth =
    daylightLossLastMonthRaw !== null && daylightLossLastMonthRaw > 0
      ? daylightLossLastMonthRaw
      : null;
  const daylightAfter5pm =
    todaySunsetMinutes !== null ? Math.max(0, todaySunsetMinutes - 17 * 60) : null;

  const daysUntilSunsetAfter5pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    17 * 60
  );
  const daysUntilSunsetAfter6pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    18 * 60
  );
  const daysUntilSunsetAfter7pm = astronomy.getDaysUntilSunsetAfter(
    todayParts,
    todaySunsetMinutes,
    19 * 60
  );
  const daysUntilMaxDailyGain = maxDailyGainDateParts
    ? getDaysBetweenDateParts(todayParts, maxDailyGainDateParts)
    : null;

  const currentSeasonParts = astronomy.getSeasonDatePartsForYear(todayParts.year, hemisphere);
  const previousSummerSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "summer"
  );
  const springEquinoxDate = getLocalNoonDateFromParts(currentSeasonParts.spring, timeZone);
  const summerSolsticeDate = getLocalNoonDateFromParts(previousSummerSolsticeParts, timeZone);
  const winterSolsticeDate = getLocalNoonDateFromParts(currentSeasonParts.winter, timeZone);

  const daysUntilSummerSolsticeRaw = currentSeasonParts.summer
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.summer)
    : null;
  const daysUntilSummerSolstice =
    daysUntilSummerSolsticeRaw !== null && daysUntilSummerSolsticeRaw > 0
      ? daysUntilSummerSolsticeRaw
      : null;
  const daysUntilWinterSolsticeRaw = currentSeasonParts.winter
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.winter)
    : null;
  const daysUntilWinterSolstice =
    daysUntilWinterSolsticeRaw !== null && daysUntilWinterSolsticeRaw > 0
      ? daysUntilWinterSolsticeRaw
      : null;
  const daysUntilEarliestSunset = earliestSunsetDateParts
    ? getDaysBetweenDateParts(todayParts, earliestSunsetDateParts)
    : null;
  const daysInYear = getDaysInYear(todayParts.year);

  const weeksWithSunsetAfter7pmRemaining =
    todaySunsetMinutes !== null ? astronomy.getWeeksWithSunsetAfter(todayParts, 19 * 60) : null;
  const averageWinterDaylight = await astronomy.getAverageWinterDaylightAsync(
    currentSeasonParts.winter,
    hemisphere
  );
  const todayDate = getLocalNoonDateFromParts(todayParts, timeZone);
  const earliestSunsetDate = getLocalNoonDateFromParts(earliestSunsetDateParts, timeZone);

  const messageData = {
    sunset_today: todaySunsetMinutes,
    sunset_earliest: earliestSunsetMinutes,
    sunset_start_of_year: sunsetStartOfYear,
    sunset_one_month_ago: monthSunsetMinutes,
    daylight_minimum: shortestDayMinutes,
    daylight_at_end_of_month: daylightAtEndOfMonth,
    daylight_today: todayDaylight,
    daylight_after_5pm_today: daylightAfter5pm,
    daylight_one_month_ago: monthDaylight,
    fraction_of_loss_completed: fractionOfLossCompleted,
    daylight_daily_gain_this_week_min: astronomy.getDaylightDailyGainThisWeekMin(todayParts),
    daylight_in_14_days: daylightIn14Days,
    daylight_gain_this_week: daylightGainThisWeek,
    spring_equinox_date: springEquinoxDate,
    today_date: todayDate,
    daylight_gain_today: daylightGainToday,
    daylight_loss_this_month: daylightLossThisMonth,
    daylight_loss_last_month: daylightLossLastMonth,
    days_until_sunset_after_5pm: daysUntilSunsetAfter5pm,
    days_until_sunset_after_6pm: daysUntilSunsetAfter6pm,
    days_until_sunset_after_7pm: daysUntilSunsetAfter7pm,
    days_until_max_daily_gain: daysUntilMaxDailyGain,
    days_until_summer_solstice: daysUntilSummerSolstice,
    weeks_with_sunset_after_7pm_remaining: weeksWithSunsetAfter7pmRemaining,
    days_until_winter_solstice: daysUntilWinterSolstice,
    days_until_earliest_sunset: daysUntilEarliestSunset,
    daylight_maximum: longestDayMinutes,
    summer_solstice_date: summerSolsticeDate,
    winter_solstice_date: winterSolsticeDate,
    days_with_less_daylight: daysWithLessDaylight,
    days_in_year: daysInYear,
    date_today: todayDate,
    date_of_earliest_sunset: earliestSunsetDate,
    average_winter_daylight: averageWinterDaylight,
    daylight_loss_this_week: daylightLossThisWeek,
  };

  return { messageData, daylightGainToday };
};

/**
 * Build a milestone object
 */
const buildMilestone = ({ id, title, dateParts, todayHeadline, todayLede }) => {
  if (!dateParts) return null;
  return { id, title, dateParts, todayHeadline, todayLede };
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
  formatTimeFromMinutes
) => {
  const { todaySunsetMinutes, yearlyExtremes } = metrics;
  const { earliestSunsetDateParts, shortestDayDateParts, longestDayDateParts } = yearlyExtremes;

  const milestoneCandidates = [];
  const addMilestone = (milestoneItem) => {
    if (milestoneItem) milestoneCandidates.push(milestoneItem);
  };

  let nextYearExtremes = null;
  const resolveNextExtreme = (key) => {
    const current = { earliestSunsetDateParts, shortestDayDateParts, longestDayDateParts }[key];
    if (current && compareDateParts(current, todayParts) >= 0) {
      return current;
    }
    if (!nextYearExtremes) {
      nextYearExtremes = astronomy.getYearlySunExtremes(todayParts.year + 1, null);
    }
    return nextYearExtremes[key] || null;
  };

  const previousWinterSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "winter"
  );

  const sunsetThresholdMatches = SUNSET_THRESHOLD_MILESTONES.map((milestoneConfig) => ({
    ...milestoneConfig,
    match: astronomy.findFirstSunsetAfter(previousWinterSolsticeParts, milestoneConfig.minutes),
  }));

  // Next half-hour sunset milestone
  if (todaySunsetMinutes !== null) {
    const targetMinutes = astronomy.getNextHalfHour(todaySunsetMinutes);
    if (targetMinutes > 0) {
      const targetLabel = formatTimeFromMinutes(targetMinutes, todayParts, timeZone);
      const milestoneMatch = astronomy.findNextSunsetThreshold(todayParts, targetMinutes);
      if (milestoneMatch) {
        const isThresholdDuplicate = sunsetThresholdMatches.some(
          (threshold) =>
            threshold.minutes === targetMinutes &&
            threshold.match?.dateParts &&
            compareDateParts(threshold.match.dateParts, milestoneMatch.dateParts) === 0
        );
        if (!isThresholdDuplicate) {
          addMilestone(
            buildMilestone({
              id: `next-sunset-${targetMinutes}`,
              title: `Next ${targetLabel} Sunset`,
              dateParts: milestoneMatch.dateParts,
            })
          );
        }
      }
    }
  }

  addMilestone(
    buildMilestone({
      id: "earliest-sunset",
      title: "Earliest sunset",
      dateParts: resolveNextExtreme("earliestSunsetDateParts"),
      todayHeadline: "It's the earliest sunset of the year.",
      todayLede: "Brighter evenings are on the way.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "shortest-day",
      title: "Shortest day",
      dateParts: resolveNextExtreme("shortestDayDateParts"),
      todayHeadline: "Today is the shortest day of the year.",
      todayLede: "Longer days start tomorrow.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "longest-day",
      title: "Longest day",
      dateParts: resolveNextExtreme("longestDayDateParts"),
      todayHeadline: "Today is the longest day of the year.",
      todayLede: "Soak up every extra minute.",
    })
  );
  addMilestone(
    buildMilestone({
      id: "spring-equinox",
      title: "Spring equinox",
      dateParts: astronomy.getNextSeasonDateParts(todayParts, hemisphere, "spring"),
      todayHeadline: "It's the spring equinox today.",
      todayLede: null,
    })
  );
  addMilestone(
    buildMilestone({
      id: "dst-start",
      title: "Daylight savings time starts",
      dateParts: astronomy.findNextDaylightSavingsStart(todayParts),
      todayHeadline: "Daylight savings time starts today.",
      todayLede: "Don't forget to spring forward.",
    })
  );

  const firstTwelveHours = astronomy.findFirstDaylightAtLeast(previousWinterSolsticeParts, 12 * 60);
  addMilestone(
    buildMilestone({
      id: "first-12-hours",
      title: "First day with at least 12 hours of daylight",
      dateParts: firstTwelveHours?.dateParts,
      todayHeadline: "Today has at least 12 hours of daylight.",
      todayLede: "A perfect balance of day and night.",
    })
  );

  DAYLIGHT_DURATION_MILESTONES.forEach((milestoneConfig) => {
    const match = astronomy.findFirstDaylightAtLeast(
      previousWinterSolsticeParts,
      milestoneConfig.minutes
    );
    addMilestone(
      buildMilestone({
        id: milestoneConfig.id,
        title: milestoneConfig.title,
        dateParts: match?.dateParts,
        todayHeadline: milestoneConfig.todayHeadline,
        todayLede: milestoneConfig.todayLede,
      })
    );
  });

  sunsetThresholdMatches.forEach((milestoneConfig) => {
    addMilestone(
      buildMilestone({
        id: milestoneConfig.id,
        title: milestoneConfig.title,
        dateParts: milestoneConfig.match?.dateParts,
        todayHeadline: milestoneConfig.todayHeadline,
        todayLede: milestoneConfig.todayLede,
      })
    );
  });

  DAYLIGHT_GAIN_MILESTONES.forEach((milestoneConfig) => {
    const match = astronomy.findFirstDaylightGain(
      previousWinterSolsticeParts,
      milestoneConfig.minutes
    );
    addMilestone(
      buildMilestone({
        id: milestoneConfig.id,
        title: milestoneConfig.title,
        dateParts: match?.dateParts,
        todayHeadline: milestoneConfig.todayHeadline,
        todayLede: milestoneConfig.todayLede,
      })
    );
  });

  const milestoneOffsets = milestoneCandidates
    .map((item) => withMilestoneOffset(item, todayParts))
    .filter(Boolean);

  const todayMilestone = milestoneOffsets.find((item) => item.offsetDays === 0);
  const upcoming = milestoneOffsets
    .filter((item) => item.offsetDays > 0)
    .sort((a, b) => {
      const dayDiff = a.offsetDays - b.offsetDays;
      if (dayDiff !== 0) return dayDiff;
      return a.title.localeCompare(b.title);
    });

  return { todayMilestone, upcoming };
};

/**
 * Main function to update daylight information for a location.
 * Uses async operations to avoid blocking the main thread during heavy calculations.
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

  const timeZone = location.timezone || fallbackTimeZone;
  const hemisphere = location.latitude < 0 ? "south" : "north";
  const astronomy = createAstronomyContext(location, timeZone);
  const todayParts = getActiveDateParts(timeZone);
  syncDatePicker(timeZone);

  // 1. Calculate all sun metrics (async to yield to main thread during full-year scan)
  const metrics = await calculateSunMetrics(astronomy, todayParts, timeZone);

  // 2. Calculate deltas and comparison mode
  const deltas = calculateDeltas(metrics);

  // 3. Update stats display
  updateStatsUI(dom, metrics, deltas, timeZone, formatters);

  // 4. Build milestones (needed for optimistic message fallback ledes)
  const { todayMilestone, upcoming } = buildUpcomingMilestones(
    astronomy,
    todayParts,
    metrics,
    hemisphere,
    timeZone,
    formatters.formatTimeFromMinutes
  );

  // 5. Build and display optimistic message (async to yield during winter daylight average)
  const { messageData, daylightGainToday } = await buildMessageData(
    astronomy,
    todayParts,
    metrics,
    deltas,
    hemisphere,
    timeZone,
    formatters.formatTimeFromMinutes
  );
  updateOptimisticMessage({
    data: messageData,
    month: todayParts.month,
    hemisphere,
    headline: dom.headline,
    lede: dom.lede,
    getActiveDateParts,
    formatLongDateFromParts: formatters.formatLongDateFromParts,
    fallbackTimeZone,
    upcomingMilestones: upcoming,
  });

  // 6. Handle today's milestone (overrides optimistic message)
  if (todayMilestone) {
    stopOptimisticRotation(dom.headline, dom.lede);
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

  // 7. Update share snapshot
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
  });
};
