/**
 * Consolidated formatting functions for Sunshine Optimist
 * All display formatting logic is centralized here
 */

import { clampValue } from "../utils/utils.js";

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Format minutes as hours and minutes (e.g., "12h 34m" or "45m")
 */
export const formatDuration = (minutes) => {
  const totalMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

/**
 * Format minutes value for messages (e.g., "45 minutes" or "1 hr 30 mins")
 */
export const formatMinutesValue = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(Math.abs(value));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    const hourLabel = hours === 1 ? "hr" : "hrs";
    if (mins === 0) {
      return `${hours} ${hourLabel}`;
    }
    const minLabel = mins === 1 ? "min" : "mins";
    return `${hours} ${hourLabel} ${mins} ${minLabel}`;
  }
  const minLabel = rounded === 1 ? "minute" : "minutes";
  return `${rounded} ${minLabel}`;
};

/**
 * Format minutes for share text (e.g., "45 mins")
 */
export const formatShareMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return "—";
  }
  const rounded = Math.round(Math.abs(minutes));
  const label = rounded === 1 ? "min" : "mins";
  return `${rounded} ${label}`;
};

// ============================================================================
// Days/Weeks Formatting
// ============================================================================

/**
 * Format days value for messages (e.g., "3 days" or "less than 2 weeks")
 */
export const formatDaysValue = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(Math.abs(value));
  if (rounded > 14) {
    const weeks = Math.ceil(rounded / 7);
    const weekLabel = weeks === 1 ? "week" : "weeks";
    return `less than ${weeks} ${weekLabel}`;
  }
  const dayLabel = rounded === 1 ? "day" : "days";
  return `${rounded} ${dayLabel}`;
};

/**
 * Format weeks value for messages (e.g., "2 weeks")
 */
export const formatWeeksValue = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(Math.abs(value));
  const weekLabel = rounded === 1 ? "week" : "weeks";
  return `${rounded} ${weekLabel}`;
};

/**
 * Format day count for share text (e.g., "3 days")
 */
export const formatShareDayCount = (days) => {
  if (!Number.isFinite(days)) {
    return "";
  }
  const rounded = Math.round(days);
  if (rounded <= 0) {
    return "";
  }
  const label = rounded === 1 ? "day" : "days";
  return `${rounded} ${label}`;
};

/**
 * Format milestone "away" text (e.g., "(3 days away)" or "(< 2 weeks away)")
 */
export const formatMilestoneAway = (offsetDays) => {
  if (!Number.isFinite(offsetDays)) {
    return "";
  }
  const rounded = Math.round(Math.abs(offsetDays));
  if (rounded > 14) {
    const rawWeeks = rounded / 7;
    const wholeWeeks = Number.isInteger(rawWeeks);
    const weeks = wholeWeeks ? rawWeeks : Math.ceil(rawWeeks);
    const weekLabel = weeks === 1 ? "week" : "weeks";
    const prefix = wholeWeeks ? "" : "< ";
    return `(${prefix}${weeks} ${weekLabel} away)`;
  }
  const dayLabel = rounded === 1 ? "day" : "days";
  return `(${rounded} ${dayLabel} away)`;
};

// ============================================================================
// Percentage Formatting
// ============================================================================

/**
 * Format percentage value for messages (e.g., "75%")
 */
export const formatPercentValue = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${Math.round(value)}%`;
};

/**
 * Format percentage for share text (e.g., "75%")
 */
export const formatSharePercent = (fraction) => {
  if (!Number.isFinite(fraction)) {
    return "";
  }
  return `${Math.round(clampValue(fraction, 0, 1) * 100)}%`;
};

// ============================================================================
// Delta Statement Formatting
// ============================================================================

/**
 * Format a delta value with descriptor (e.g., "15 minutes later")
 */
export const formatDeltaStatement = (minutes, positiveLabel, negativeLabel) => {
  if (minutes === null || Number.isNaN(minutes)) {
    return "";
  }
  const rounded = Math.round(minutes);
  const abs = Math.abs(rounded);
  const value = abs >= 60 ? formatDuration(abs) : `${abs} ${abs === 1 ? "minute" : "minutes"}`;
  const descriptor = rounded >= 0 ? positiveLabel : negativeLabel;
  return `${value} ${descriptor}`;
};

/**
 * Format a comparison tooltip (e.g., "4:30 PM on Dec 15")
 */
export const formatComparisonTooltip = (
  value,
  parts,
  timeZone,
  referenceYear,
  formatShortDateFn
) => {
  if (!value || !parts) {
    return "";
  }
  const dateLabel = formatShortDateFn(parts, timeZone, referenceYear);
  if (!dateLabel) {
    return "";
  }
  return `${value} on ${dateLabel}`;
};

// ============================================================================
// Share Text Formatting
// ============================================================================

const SHARE_MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

/**
 * Format date for share text (e.g., "Jan. 15")
 */
export const formatShareDateFromParts = (parts) => {
  if (!parts) {
    return "";
  }
  const monthLabel = SHARE_MONTHS[parts.month - 1];
  if (!monthLabel) {
    return "";
  }
  return `${monthLabel} ${parts.day}`;
};

/**
 * Build a progress bar using Unicode blocks
 */
export const buildShareBar = (fraction, length = 20) => {
  if (!Number.isFinite(fraction)) {
    return "";
  }
  const clamped = clampValue(fraction, 0, 1);
  const filledCount = Math.round(clamped * length);
  const emptyCount = length - filledCount;
  return `${"█".repeat(filledCount)}${"░".repeat(emptyCount)}`;
};

/**
 * Lowercase the first letter of a string
 */
export const lowerCaseFirstLetter = (value) => {
  if (!value) {
    return "";
  }
  const first = value[0];
  if (first.toLowerCase() === first) {
    return value;
  }
  return `${first.toLowerCase()}${value.slice(1)}`;
};

// ============================================================================
// Message Placeholder Formatting
// ============================================================================

/**
 * Format a placeholder value based on its token type
 */
export const formatPlaceholderValue = (token, value) => {
  const normalized = token.trim().toLowerCase();
  if (normalized.includes("%")) {
    return formatPercentValue(value);
  }
  if (normalized.includes("day")) {
    return formatDaysValue(value);
  }
  if (normalized.includes("week")) {
    return formatWeeksValue(value);
  }
  if (normalized.includes("minute")) {
    const minutesText = formatMinutesValue(value);
    if (normalized.includes("more")) {
      return `${minutesText} more`;
    }
    return minutesText;
  }
  return String(value);
};

// ============================================================================
// Log/Debug Formatting
// ============================================================================

/**
 * Format headline for log output (ensures it ends with punctuation)
 */
export const formatOptimisticLogHeadline = (headline) => {
  const trimmed = (headline || "").trim();
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * Build a single log line for an optimistic message entry
 */
export const buildOptimisticLogLine = (entry) => {
  if (!entry) {
    return "-";
  }
  const headline = formatOptimisticLogHeadline(entry.headline);
  const lede = (entry.lede || "").trim();
  if (headline && lede) {
    return `- ${headline} ${lede}`;
  }
  if (headline) {
    return `- ${headline}`;
  }
  if (lede) {
    return `- ${lede}`;
  }
  return "-";
};
