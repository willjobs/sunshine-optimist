import { clampValue } from "./utils.js";
import { getAdjustedMonth } from "./date-utils.js";

const SHARE_BAR_LENGTH = 20;
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

export const formatShareMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return "—";
  }
  const rounded = Math.round(Math.abs(minutes));
  const label = rounded === 1 ? "min" : "mins";
  return `${rounded} ${label}`;
};

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

export const formatSharePercent = (fraction) => {
  if (!Number.isFinite(fraction)) {
    return "";
  }
  return `${Math.round(clampValue(fraction, 0, 1) * 100)}%`;
};

export const buildShareBar = (fraction) => {
  if (!Number.isFinite(fraction)) {
    return "";
  }
  const clamped = clampValue(fraction, 0, 1);
  const filledCount = Math.round(clamped * SHARE_BAR_LENGTH);
  const emptyCount = SHARE_BAR_LENGTH - filledCount;
  return `${"█".repeat(filledCount)}${"░".repeat(emptyCount)}`;
};

const getShareProgressMode = (month, hemisphere) => {
  if (!Number.isFinite(month)) {
    return "max";
  }
  const adjustedMonth = getAdjustedMonth(month, hemisphere);
  if (adjustedMonth >= 6 && adjustedMonth <= 8) {
    return "none";
  }
  if (adjustedMonth >= 9 && adjustedMonth <= 12) {
    return "shortest";
  }
  return "max";
};

const getLossFraction = (snapshot) => {
  if (
    !Number.isFinite(snapshot?.todayDaylight) ||
    !Number.isFinite(snapshot?.longestDayMinutes) ||
    !Number.isFinite(snapshot?.shortestDayMinutes)
  ) {
    return null;
  }
  const totalLoss = snapshot.longestDayMinutes - snapshot.shortestDayMinutes;
  if (totalLoss <= 0) {
    return null;
  }
  return clampValue(
    (snapshot.longestDayMinutes - snapshot.todayDaylight) / totalLoss,
    0,
    1
  );
};

export const buildShareProgressLine = (snapshot) => {
  if (!snapshot) {
    return "";
  }
  const isShortening = Number.isFinite(snapshot.daylightGainToday)
    ? snapshot.daylightGainToday < 0
    : false;
  const mode = isShortening
    ? getShareProgressMode(snapshot.dateParts?.month, snapshot.hemisphere)
    : "max";
  if (mode === "none") {
    return "";
  }
  if (mode === "shortest") {
    const fraction =
      snapshot.fractionOfLossCompleted != null
        ? snapshot.fractionOfLossCompleted
        : getLossFraction(snapshot);
    if (!Number.isFinite(fraction)) {
      return "";
    }
    const percentText = formatSharePercent(fraction);
    return `${buildShareBar(fraction)} Progress towards shortest day${
      percentText ? ` (${percentText})` : ""
    }`.trim();
  }
  if (!Number.isFinite(snapshot.longestDayMinutes)) {
    return "";
  }
  const fraction =
    Number.isFinite(snapshot.todayDaylight) && snapshot.longestDayMinutes > 0
      ? snapshot.todayDaylight / snapshot.longestDayMinutes
      : null;
  if (!Number.isFinite(fraction)) {
    return "";
  }
  const percentText = formatSharePercent(fraction);
  return `${buildShareBar(fraction)} ${percentText} of maximum daylight`.trim();
};
