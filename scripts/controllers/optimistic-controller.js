/**
 * Optimistic Message Controller
 *
 * Handles optimistic message selection, rotation, and debug logging.
 */

import { getOptimisticMessageOptions } from "../messages.js";
import {
  getOptimisticDebugState,
  updateDebugState,
  getActiveLocation,
} from "../state/app-state.js";
import {
  startOptimisticRotation,
  OPTIMISTIC_POLAR_COPY,
  OPTIMISTIC_POLAR_DAY_COPY,
  createPolarNightCopy,
  OPTIMISTIC_FALLBACK_COPY,
} from "../ui/message-ui.js";
import { buildOptimisticLogLine } from "../formatters/formatters.js";
import { formatSelectedLocation } from "../utils/location-utils.js";

/**
 * Log optimistic messages to the console for debugging
 * @param {Function} getActiveDateParts - Function to get active date parts
 * @param {Function} formatLongDateFromParts - Function to format date parts
 * @param {string} fallbackTimeZone - Fallback timezone if no location
 */
export const logOptimisticMessages = (
  getActiveDateParts,
  formatLongDateFromParts,
  fallbackTimeZone
) => {
  // eslint-disable-next-line no-console
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  const location = getActiveLocation();
  const timeZone = location?.timezone || fallbackTimeZone;
  const dateParts = getActiveDateParts(timeZone);
  const locationLabel = location ? formatSelectedLocation(location) : "";
  const dateLabel = dateParts ? formatLongDateFromParts(dateParts, timeZone) : "";
  const debugState = getOptimisticDebugState();
  const list = debugState.validOptions.length
    ? debugState.validOptions
    : debugState.displayedOptions;
  const header = `Optimistic messages for ${
    locationLabel || "Unknown location"
  } on ${dateLabel || "Unknown date"}:`;
  const lines = list.map(buildOptimisticLogLine);
  // eslint-disable-next-line no-console
  console.log([header, ...lines].join("\n"));
};

/**
 * Update the optimistic message display
 * @param {Object} params - Parameters object
 * @param {Object} params.data - Message data object with daylight/sunset values
 * @param {number} params.month - Current month (1-12)
 * @param {string} params.hemisphere - "north" or "south"
 * @param {HTMLElement} params.headline - Headline DOM element
 * @param {HTMLElement} params.lede - Lede DOM element
 * @param {Object} params.controls - Optimistic message navigation controls
 * @param {Function} params.getActiveDateParts - Function to get active date parts
 * @param {Function} params.formatLongDateFromParts - Function to format date parts
 * @param {string} params.fallbackTimeZone - Fallback timezone
 * @param {Array} params.upcomingMilestones - Array of upcoming milestones for fallback ledes
 * @param {string} params.polarState - "normal", "polar-day", or "polar-night"
 * @param {number|null} params.daysUntilFirstSunrise - Days until first sunrise (polar night)
 */
export const updateOptimisticMessage = ({
  data,
  month,
  hemisphere,
  headline,
  lede,
  controls,
  getActiveDateParts,
  formatLongDateFromParts,
  fallbackTimeZone,
  upcomingMilestones = [],
  polarState = "normal",
  daysUntilFirstSunrise = null,
}) => {
  updateDebugState({ data, month, hemisphere });

  const logMessages = () => {
    logOptimisticMessages(getActiveDateParts, formatLongDateFromParts, fallbackTimeZone);
  };

  // Handle polar day (24-hour sunlight)
  if (polarState === "polar-day") {
    updateDebugState({
      validOptions: [],
      displayedOptions: [OPTIMISTIC_POLAR_DAY_COPY],
      reason: "polar-day",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_POLAR_DAY_COPY], controls);
    logMessages();
    return;
  }

  // Handle polar night (no sunlight)
  if (polarState === "polar-night") {
    const polarNightCopy = createPolarNightCopy(daysUntilFirstSunrise);
    updateDebugState({
      validOptions: [],
      displayedOptions: [polarNightCopy],
      reason: "polar-night",
    });
    startOptimisticRotation(headline, lede, [polarNightCopy], controls);
    logMessages();
    return;
  }

  // Handle transition days or other polar edge cases
  if (
    data.sunset_today === null ||
    Number.isNaN(data.sunset_today) ||
    data.daylight_today === null ||
    Number.isNaN(data.daylight_today)
  ) {
    updateDebugState({
      validOptions: [],
      displayedOptions: [OPTIMISTIC_POLAR_COPY],
      reason: "polar",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_POLAR_COPY], controls);
    logMessages();
    return;
  }

  const options = getOptimisticMessageOptions(data, month, hemisphere, upcomingMilestones);
  updateDebugState({ validOptions: options });

  if (!options.length) {
    updateDebugState({
      displayedOptions: [OPTIMISTIC_FALLBACK_COPY],
      reason: "fallback",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_FALLBACK_COPY], controls);
    logMessages();
    return;
  }

  updateDebugState({
    displayedOptions: options,
    reason: "ok",
  });
  startOptimisticRotation(headline, lede, options, controls);
  logMessages();
};
