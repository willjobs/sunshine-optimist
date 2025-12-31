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
  OPTIMISTIC_FALLBACK_COPY,
} from "../ui/message-ui.js";
import {
  formatOptimisticLogHeadline,
  buildOptimisticLogLine,
} from "../formatters/formatters.js";
import { formatSelectedLocation } from "../utils/location-utils.js";

/**
 * Log optimistic messages to the console for debugging
 * @param {Function} getActiveDateParts - Function to get active date parts
 * @param {Function} formatLongDateFromParts - Function to format date parts
 * @param {string} fallbackTimeZone - Fallback timezone if no location
 */
export const logOptimisticMessages = (getActiveDateParts, formatLongDateFromParts, fallbackTimeZone) => {
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
 * @param {Function} params.getActiveDateParts - Function to get active date parts
 * @param {Function} params.formatLongDateFromParts - Function to format date parts
 * @param {string} params.fallbackTimeZone - Fallback timezone
 */
export const updateOptimisticMessage = ({
  data,
  month,
  hemisphere,
  headline,
  lede,
  getActiveDateParts,
  formatLongDateFromParts,
  fallbackTimeZone,
}) => {
  updateDebugState({ data, month, hemisphere });

  const logMessages = () => {
    logOptimisticMessages(getActiveDateParts, formatLongDateFromParts, fallbackTimeZone);
  };

  if (
    data.sunset_today == null ||
    Number.isNaN(data.sunset_today) ||
    data.daylight_today == null ||
    Number.isNaN(data.daylight_today)
  ) {
    updateDebugState({
      validOptions: [],
      displayedOptions: [OPTIMISTIC_POLAR_COPY],
      reason: "polar",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_POLAR_COPY]);
    logMessages();
    return;
  }

  const options = getOptimisticMessageOptions(data, month, hemisphere);
  updateDebugState({ validOptions: options });

  if (!options.length) {
    updateDebugState({
      displayedOptions: [OPTIMISTIC_FALLBACK_COPY],
      reason: "fallback",
    });
    startOptimisticRotation(headline, lede, [OPTIMISTIC_FALLBACK_COPY]);
    logMessages();
    return;
  }

  updateDebugState({
    displayedOptions: options,
    reason: "ok",
  });
  startOptimisticRotation(headline, lede, options);
  logMessages();
};
