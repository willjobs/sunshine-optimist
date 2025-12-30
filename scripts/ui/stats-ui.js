/**
 * Stats panel rendering for sunset and daylight information
 */

import { setText } from "../dom-utils.js";
import { formatDuration, formatDeltaStatement, formatComparisonTooltip } from "../formatters/formatters.js";
import { updateDeltaTooltip } from "./tooltip-ui.js";

/**
 * Update stats panel display
 * @param {Object} dom - DOM elements for stats
 * @param {Object} data - Calculated daylight data
 * @param {Object} formatters - Formatting functions
 */
export const updateStatsDisplay = (dom, data, formatters) => {
  const {
    sunsetTimeValue,
    sunsetEarliestDeltaValue,
    sunsetComparisonDeltaValue,
    daylightDurationValue,
    daylightShortestDeltaValue,
    daylightComparisonDeltaValue,
    sunsetEarliestRow,
    sunsetComparisonRow,
    daylightShortestRow,
    daylightComparisonRow,
    sunsetEarliestReference,
    sunsetComparisonReference,
    daylightShortestReference,
    daylightComparisonReference,
  } = dom;

  const { formatTime, formatShortDateFromParts } = formatters;

  // Sunset time
  setText(
    sunsetTimeValue,
    data.todayEvents.sunset
      ? formatTime(data.todayEvents.sunset.date, data.timeZone)
      : "—"
  );

  // Sunset earliest delta
  const sunsetEarliestText = formatDeltaStatement(
    data.sunsetEarliestDelta,
    "later",
    "earlier"
  );
  setText(sunsetEarliestDeltaValue, sunsetEarliestText);

  // Daylight duration
  setText(
    daylightDurationValue,
    data.todayDaylight == null ? "—" : formatDuration(data.todayDaylight)
  );

  // Daylight shortest delta
  const daylightShortestText = formatDeltaStatement(
    data.daylightShortestDelta,
    "longer",
    "shorter"
  );
  setText(daylightShortestDeltaValue, daylightShortestText);

  // Hide rows without values
  if (sunsetEarliestRow) {
    sunsetEarliestRow.classList.toggle("is-hidden", !sunsetEarliestText);
  }
  if (daylightShortestRow) {
    daylightShortestRow.classList.toggle("is-hidden", !daylightShortestText);
  }

  // Comparison period deltas
  const sunsetComparisonText = data.showComparison
    ? formatDeltaStatement(data.sunsetComparisonDelta, "later", "earlier")
    : "";
  const daylightComparisonText = data.showComparison
    ? formatDeltaStatement(data.daylightComparisonDelta, "longer", "shorter")
    : "";

  const showSunsetComparison = Boolean(sunsetComparisonText);
  const showDaylightComparison = Boolean(daylightComparisonText);

  if (sunsetComparisonRow) {
    sunsetComparisonRow.classList.toggle("is-hidden", !showSunsetComparison);
  }
  if (daylightComparisonRow) {
    daylightComparisonRow.classList.toggle("is-hidden", !showDaylightComparison);
  }

  setText(sunsetComparisonReference, showSunsetComparison ? data.comparisonReference : "");
  setText(daylightComparisonReference, showDaylightComparison ? data.comparisonReference : "");
  setText(sunsetComparisonDeltaValue, sunsetComparisonText);
  setText(daylightComparisonDeltaValue, daylightComparisonText);

  // Tooltips
  const sunsetEarliestTooltip =
    data.earliestSunsetMinutes != null && data.earliestSunsetDateParts
      ? formatComparisonTooltip(
          formatters.formatTimeFromMinutes(
            data.earliestSunsetMinutes,
            data.earliestSunsetDateParts,
            data.timeZone
          ),
          data.earliestSunsetDateParts,
          data.timeZone,
          data.referenceYear,
          formatShortDateFromParts
        )
      : "";
  updateDeltaTooltip(sunsetEarliestReference, sunsetEarliestText ? sunsetEarliestTooltip : "");

  const sunsetComparisonTooltip = data.comparisonMode === "week"
    ? data.sunsetWeekTooltip
    : data.sunsetMonthTooltip;
  updateDeltaTooltip(sunsetComparisonReference, showSunsetComparison ? sunsetComparisonTooltip : "");

  const daylightShortestTooltip =
    data.shortestDayMinutes != null && data.shortestDayDateParts
      ? formatComparisonTooltip(
          formatDuration(data.shortestDayMinutes),
          data.shortestDayDateParts,
          data.timeZone,
          data.referenceYear,
          formatShortDateFromParts
        )
      : "";
  updateDeltaTooltip(daylightShortestReference, daylightShortestText ? daylightShortestTooltip : "");

  const daylightComparisonTooltip = data.comparisonMode === "week"
    ? data.daylightWeekTooltip
    : data.daylightMonthTooltip;
  updateDeltaTooltip(daylightComparisonReference, showDaylightComparison ? daylightComparisonTooltip : "");
};
