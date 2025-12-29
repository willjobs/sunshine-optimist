import { selectOptimisticMessage } from "./messages.js";
import {
  DAYLIGHT_GAIN_MILESTONES,
  SUNSET_THRESHOLD_MILESTONES,
} from "./milestones.js";
import { clampValue } from "./utils.js";

const shareButton = document.getElementById("share");
const headline = document.getElementById("headline");
const lede = document.getElementById("lede");
const cityInput = document.getElementById("city-input");
const geolocateButton = document.getElementById("location-geolocate");
const resultsPanel = document.getElementById("location-results");
const resultsMeta = document.getElementById("location-results-meta");
const resultsActions = document.getElementById("location-results-actions");
const resultsList = document.getElementById("location-results-list");
const clearButton = document.getElementById("location-clear");
const milestone = document.querySelector(".milestone");
const milestoneToggle = document.getElementById("milestone-toggle");
const confettiRoot = document.getElementById("confetti");
const sunsetTimeValue = document.getElementById("sunset-time");
const sunsetEarliestDeltaValue = document.getElementById("sunset-earliest-delta");
const sunsetWeekDeltaValue = document.getElementById("sunset-week-delta");
const sunsetMonthDeltaValue = document.getElementById("sunset-month-delta");
const daylightDurationValue = document.getElementById("daylight-duration");
const daylightShortestDeltaValue = document.getElementById("daylight-shortest-delta");
const daylightWeekDeltaValue = document.getElementById("daylight-week-delta");
const daylightMonthDeltaValue = document.getElementById("daylight-month-delta");
const sunsetEarliestRow = document.getElementById("sunset-earliest-row");
const sunsetWeekRow = document.getElementById("sunset-week-row");
const sunsetMonthRow = document.getElementById("sunset-month-row");
const daylightShortestRow = document.getElementById("daylight-shortest-row");
const daylightWeekRow = document.getElementById("daylight-week-row");
const daylightMonthRow = document.getElementById("daylight-month-row");
const sunsetComparisonLabel = sunsetMonthRow?.querySelector(".delta-label");
const daylightComparisonLabel = daylightMonthRow?.querySelector(".delta-label");
const nextHeadline = document.getElementById("next-headline");
const nextDate = document.getElementById("next-date");
const nextAway = document.getElementById("next-away");
const dateInput = document.getElementById("date-input");
const dateReset = document.getElementById("date-reset");
const datePicker = document.querySelector(".date-picker");
let suggestionResults = [];
let rawResults = [];
let activeIndex = -1;
let debounceId = null;
let fetchController = null;
let preferLocalResults = true;
let lastQuery = "";
let lastNameQuery = "";
let locationBiasRequested = false;
let locationBiasLoading = false;
let userCoords = null;
let lastFilterTokens = [];
let lastFilterTokensRaw = [];
let recentLocations = [];
let activeLocation = null;
let useLiveDate = true;
let customDateParts = null;
let dateCommitTimeoutId = null;
let lastDateKeydownAt = 0;
let upcomingMilestones = [];
let milestoneIndex = 0;
let milestoneTimeZone = null;
let lastCelebratedKey = null;
let confettiTimeoutId = null;
const localeSource = navigator.languages?.[0] || navigator.language || "en";
const languageCode = localeSource.split("-")[0] || "en";
const regionCode = (localeSource.split("-")[1] || "").toUpperCase();
const MAX_RESULTS = 8;
const MAX_RECENTS = 5;
const RECENT_STORAGE_KEY = "sunshine-optimist:recent-locations";
const ACTIVE_LOCATION_STORAGE_KEY = "sunshine-optimist:active-location";
const CAN_USE_GEOLOCATION = "geolocation" in navigator;
const DEFAULT_LOCATION_QUERY = "Boston";
const DEFAULT_LOCATION = {
  name: "Boston",
  admin1: "Massachusetts",
  country: "United States",
  country_code: "US",
  latitude: 42.3601,
  longitude: -71.0589,
  elevation: 0,
  timezone: "America/New_York",
};
const FALLBACK_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const DATE_COMMIT_DELAY_MS = 300;
const DATE_KEYBOARD_GRACE_MS = 800;
const getZonedParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const getTimeZoneOffsetMinutes = (date, timeZone) => {
  const parts = getZonedParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return (utcTime - date.getTime()) / 60000;
};

const zonedTimeToUtc = (year, month, day, hour, minute, second, timeZone) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  let utcTime = new Date(utcGuess.getTime() - offset * 60000);
  const revisedOffset = getTimeZoneOffsetMinutes(utcTime, timeZone);
  if (revisedOffset !== offset) {
    utcTime = new Date(utcGuess.getTime() - revisedOffset * 60000);
  }
  return utcTime;
};

const getLocalDateParts = (date, timeZone) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return { year, month, day };
};

const padDatePart = (value) => String(value).padStart(2, "0");

const formatDateInputValue = (parts) => {
  if (!parts) {
    return "";
  }
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
};

const parseDateInputValue = (value) => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return { year, month, day };
};

const getActiveDateParts = (timeZone) => {
  if (!useLiveDate && customDateParts) {
    return customDateParts;
  }
  return getLocalDateParts(new Date(), timeZone);
};

const syncDatePicker = (timeZone) => {
  if (!dateInput) {
    return;
  }
  const parts = getActiveDateParts(timeZone);
  if (parts) {
    const nextValue = formatDateInputValue(parts);
    if (dateInput.value !== nextValue) {
      dateInput.value = nextValue;
    }
  }
  if (dateReset) {
    dateReset.disabled = useLiveDate;
  }
  if (datePicker) {
    datePicker.classList.toggle("is-custom", !useLiveDate);
  }
};

const clearDateCommitTimeout = () => {
  if (dateCommitTimeoutId) {
    clearTimeout(dateCommitTimeoutId);
    dateCommitTimeoutId = null;
  }
};

const applyDateSelection = (nextParts) => {
  if (nextParts) {
    if (
      !useLiveDate &&
      customDateParts &&
      customDateParts.year === nextParts.year &&
      customDateParts.month === nextParts.month &&
      customDateParts.day === nextParts.day
    ) {
      return false;
    }
    customDateParts = nextParts;
    useLiveDate = false;
    return true;
  }
  if (useLiveDate) {
    return false;
  }
  customDateParts = null;
  useLiveDate = true;
  return true;
};

const commitDateSelection = () => {
  if (!dateInput) {
    return;
  }
  clearDateCommitTimeout();
  const nextParts = parseDateInputValue(dateInput.value);
  const didChange = applyDateSelection(nextParts);
  const timeZone = activeLocation?.timezone || FALLBACK_TIMEZONE;
  syncDatePicker(timeZone);
  if (activeLocation && didChange) {
    updateDaylightForLocation(activeLocation);
  }
};

const scheduleDateCommit = () => {
  clearDateCommitTimeout();
  dateCommitTimeoutId = window.setTimeout(() => {
    dateCommitTimeoutId = null;
    commitDateSelection();
  }, DATE_COMMIT_DELAY_MS);
};

const isRecentDateKeyboardInput = () =>
  Date.now() - lastDateKeydownAt < DATE_KEYBOARD_GRACE_MS;

const addDaysToDateParts = (parts, deltaDays) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const addMonthsToDateParts = (parts, deltaMonths) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    day: Math.min(parts.day, daysInMonth),
  };
};

const getDaysInMonth = (year, month) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const compareDateParts = (left, right) => {
  if (!left || !right) {
    return 0;
  }
  if (left.year !== right.year) {
    return left.year < right.year ? -1 : 1;
  }
  if (left.month !== right.month) {
    return left.month < right.month ? -1 : 1;
  }
  if (left.day !== right.day) {
    return left.day < right.day ? -1 : 1;
  }
  return 0;
};

const getDaysBetweenDateParts = (startParts, endParts) => {
  if (!startParts || !endParts) {
    return null;
  }
  const startUtc = Date.UTC(
    startParts.year,
    startParts.month - 1,
    startParts.day
  );
  const endUtc = Date.UTC(
    endParts.year,
    endParts.month - 1,
    endParts.day
  );
  return Math.round((endUtc - startUtc) / 86400000);
};

const getDaysInYear = (year) => {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / 86400000);
};

const getMinutesSinceMidnight = (date, timeZone) => {
  const { hour, minute, second } = getZonedParts(date, timeZone);
  return hour * 60 + minute + second / 60;
};

const formatTime = (date, timeZone) =>
  new Intl.DateTimeFormat(localeSource, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const formatLongDateFromParts = (parts, timeZone) => {
  const date = zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
  return new Intl.DateTimeFormat(localeSource, {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatShortDateFromParts = (parts, timeZone, referenceYear = null) => {
  if (!parts) {
    return "";
  }
  const date = zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
  const options = {
    timeZone,
    month: "short",
    day: "numeric",
  };
  if (referenceYear != null && parts.year !== referenceYear) {
    options.year = "numeric";
  }
  return new Intl.DateTimeFormat(localeSource, options).format(date);
};

const getLocalNoonDateFromParts = (parts, timeZone) => {
  if (!parts) {
    return null;
  }
  return zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
};

const formatDuration = (minutes) => {
  const totalMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatDeltaMinutes = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) {
    return "—";
  }
  const rounded = Math.round(minutes);
  if (rounded === 0) {
    return "0 min";
  }
  const sign = rounded > 0 ? "+" : "-";
  const abs = Math.abs(rounded);
  const body = abs >= 60 ? formatDuration(abs) : `${abs} min`;
  return `${sign}${body}`;
};

const formatComparisonTooltip = (value, parts, timeZone, referenceYear) => {
  if (!value || !parts) {
    return "";
  }
  const dateLabel = formatShortDateFromParts(parts, timeZone, referenceYear);
  if (!dateLabel) {
    return "";
  }
  return `vs. ${value} on ${dateLabel}`;
};

const formatOptimisticDelta = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) {
    return "—";
  }
  const absMinutes = Math.abs(minutes);
  if (absMinutes < 1) {
    const seconds = Math.floor(absMinutes * 60);
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }
  if (absMinutes > 1 && absMinutes < 3) {
    const totalSeconds = Math.floor(absMinutes * 60);
    const wholeMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${wholeMinutes}m ${seconds}s`;
  }
  const roundedMinutes = Math.round(absMinutes);
  return `${roundedMinutes} ${roundedMinutes === 1 ? "minute" : "minutes"}`;
};

const setText = (node, value) => {
  if (!node) {
    return;
  }
  node.textContent = value == null ? "" : String(value);
};

const setInputValue = (node, value) => {
  if (!node) {
    return;
  }
  node.value = value == null ? "" : String(value);
};

const getText = (node) => (node?.textContent || "").trim();

const CONFETTI_COLORS = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#577590",
];
const CONFETTI_COUNT = 72;

const launchConfetti = () => {
  if (!confettiRoot) {
    return;
  }
  confettiRoot.innerHTML = "";
  if (confettiTimeoutId) {
    window.clearTimeout(confettiTimeoutId);
    confettiTimeoutId = null;
  }
  const fragment = document.createDocumentFragment();
  let maxDuration = 0;
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const size = 6 + Math.random() * 6;
    const duration = 3.2 + Math.random() * 1.8;
    const delay = Math.random() * 0.6;
    const drift = (Math.random() * 80 - 40).toFixed(1);
    const rotate = Math.floor(Math.random() * 360);
    const spin = rotate + (Math.random() > 0.5 ? 300 : -300);
    piece.style.setProperty("--confetti-x", `${Math.random() * 100}%`);
    piece.style.setProperty("--confetti-size", `${size.toFixed(1)}px`);
    piece.style.setProperty(
      "--confetti-color",
      CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    );
    piece.style.setProperty("--confetti-delay", `${delay.toFixed(2)}s`);
    piece.style.setProperty("--confetti-duration", `${duration.toFixed(2)}s`);
    piece.style.setProperty("--confetti-drift", `${drift}px`);
    piece.style.setProperty("--confetti-rotate", `${rotate}deg`);
    piece.style.setProperty("--confetti-spin", `${spin}deg`);
    fragment.appendChild(piece);
    maxDuration = Math.max(maxDuration, duration + delay);
  }
  confettiRoot.appendChild(fragment);
  confettiTimeoutId = window.setTimeout(() => {
    confettiRoot.innerHTML = "";
    confettiTimeoutId = null;
  }, (maxDuration + 0.5) * 1000);
};

const deltaTooltipRows = [
  sunsetEarliestRow,
  sunsetWeekRow,
  sunsetMonthRow,
  daylightShortestRow,
  daylightWeekRow,
  daylightMonthRow,
].filter(Boolean);

const closeDeltaTooltips = (exceptRow = null) => {
  deltaTooltipRows.forEach((row) => {
    if (row === exceptRow) {
      return;
    }
    if (!row.classList.contains("is-tooltip-open")) {
      return;
    }
    row.classList.remove("is-tooltip-open");
    row.setAttribute("aria-expanded", "false");
  });
};

const buildDeltaRowAriaLabel = (row, tooltipText) => {
  const labelText = getText(row.querySelector(".delta-label"));
  const valueText = getText(row.querySelector(".delta-value"));
  return [labelText, valueText, tooltipText].filter(Boolean).join(". ");
};

const updateDeltaRowPointerPosition = (row, clientX, clientY) => {
  if (!row || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return;
  }
  const rect = row.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  row.style.setProperty("--tooltip-x", `${x}px`);
  row.style.setProperty("--tooltip-y", `${y}px`);
};

const updateDeltaRowTooltip = (row, tooltipText) => {
  if (!row) {
    return;
  }
  if (!tooltipText) {
    row.classList.remove("has-tooltip", "is-tooltip-open");
    row.removeAttribute("data-tooltip");
    row.removeAttribute("tabindex");
    row.removeAttribute("role");
    row.removeAttribute("aria-label");
    row.removeAttribute("aria-expanded");
    return;
  }
  row.dataset.tooltip = tooltipText;
  row.classList.add("has-tooltip");
  row.setAttribute("tabindex", "0");
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", buildDeltaRowAriaLabel(row, tooltipText));
  row.setAttribute(
    "aria-expanded",
    row.classList.contains("is-tooltip-open") ? "true" : "false"
  );
};

deltaTooltipRows.forEach((row) => {
  row.addEventListener("pointerenter", (event) => {
    if (!row.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      updateDeltaRowPointerPosition(row, event.clientX, event.clientY);
    }
  });

  row.addEventListener("pointermove", (event) => {
    if (!row.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      updateDeltaRowPointerPosition(row, event.clientX, event.clientY);
    }
  });

  row.addEventListener("pointerdown", (event) => {
    if (!row.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }
    updateDeltaRowPointerPosition(row, event.clientX, event.clientY);
    const isOpen = row.classList.toggle("is-tooltip-open");
    row.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) {
      closeDeltaTooltips(row);
    }
  });

  row.addEventListener("keydown", (event) => {
    if (!row.classList.contains("has-tooltip")) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const isOpen = row.classList.toggle("is-tooltip-open");
      row.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        closeDeltaTooltips(row);
      }
    } else if (event.key === "Escape") {
      row.classList.remove("is-tooltip-open");
      row.setAttribute("aria-expanded", "false");
    }
  });
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".delta-row.has-tooltip")) {
    closeDeltaTooltips();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDeltaTooltips();
  }
});

const updateOptimisticMessage = (data, month, hemisphere) => {
  if (
    data.sunset_today == null ||
    Number.isNaN(data.sunset_today) ||
    data.daylight_today == null ||
    Number.isNaN(data.daylight_today)
  ) {
    setText(headline, "Sunlight looks different here.");
    setText(lede, "No sunrise or sunset today.");
    return;
  }
  const selection = selectOptimisticMessage(data, month, hemisphere);
  if (!selection) {
    setText(headline, "Enjoy the daylight today.");
    setText(lede, "Every bit of sunshine helps.");
    return;
  }
  setText(headline, selection.headline);
  setText(lede, selection.lede);
};

const getSunEvents = (observer, timeZone, dateParts) => {
  const startUtc = zonedTimeToUtc(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    0,
    0,
    0,
    timeZone
  );
  return {
    sunrise: Astronomy.SearchRiseSet("Sun", observer, +1, startUtc, 1),
    sunset: Astronomy.SearchRiseSet("Sun", observer, -1, startUtc, 1),
  };
};

const getDaylightMinutes = (events) => {
  if (!events?.sunrise || !events?.sunset) {
    return null;
  }
  return (events.sunset.date - events.sunrise.date) / 60000;
};

const getSunsetMinutesForDateParts = (observer, timeZone, dateParts) => {
  const { sunset } = getSunEvents(observer, timeZone, dateParts);
  return sunset ? getMinutesSinceMidnight(sunset.date, timeZone) : null;
};

const getDaylightMinutesForDateParts = (observer, timeZone, dateParts) =>
  getDaylightMinutes(getSunEvents(observer, timeZone, dateParts));

const getYearlySunExtremes = (observer, timeZone, year, todayDaylight) => {
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
  let daysWithLessDaylight =
    todayDaylight != null && Number.isFinite(todayDaylight) ? 0 : null;

  for (let offset = 0; offset < daysInYear; offset += 1) {
    const dateParts = addDaysToDateParts(yearStart, offset);
    const events = getSunEvents(observer, timeZone, dateParts);

    if (events.sunset) {
      const sunsetMinutes = getMinutesSinceMidnight(events.sunset.date, timeZone);
      if (earliestSunsetMinutes == null || sunsetMinutes < earliestSunsetMinutes) {
        earliestSunsetMinutes = sunsetMinutes;
        earliestSunsetDateParts = dateParts;
      }
    }

    const daylightMinutes = getDaylightMinutes(events);
    if (daylightMinutes != null) {
      if (shortestDayMinutes == null || daylightMinutes < shortestDayMinutes) {
        shortestDayMinutes = daylightMinutes;
        shortestDayDateParts = dateParts;
      }
      if (longestDayMinutes == null || daylightMinutes > longestDayMinutes) {
        longestDayMinutes = daylightMinutes;
        longestDayDateParts = dateParts;
      }
      if (
        daysWithLessDaylight != null &&
        Number.isFinite(todayDaylight) &&
        daylightMinutes < todayDaylight
      ) {
        daysWithLessDaylight += 1;
      }
      if (previousDaylightMinutes != null) {
        const gain = daylightMinutes - previousDaylightMinutes;
        if (maxDailyGainMinutes == null || gain > maxDailyGainMinutes) {
          maxDailyGainMinutes = gain;
          maxDailyGainDateParts = dateParts;
        }
      }
      previousDaylightMinutes = daylightMinutes;
    } else {
      previousDaylightMinutes = null;
    }
  }

  return {
    earliestSunsetMinutes,
    earliestSunsetDateParts,
    shortestDayMinutes,
    shortestDayDateParts,
    longestDayMinutes,
    longestDayDateParts,
    maxDailyGainMinutes,
    maxDailyGainDateParts,
    daysWithLessDaylight,
  };
};

const getSeasonDatePartsForYear = (year, timeZone, hemisphere) => {
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
  return {
    spring: getLocalDateParts(mapping.spring.date, timeZone),
    summer: getLocalDateParts(mapping.summer.date, timeZone),
    autumn: getLocalDateParts(mapping.autumn.date, timeZone),
    winter: getLocalDateParts(mapping.winter.date, timeZone),
  };
};

const getNextSeasonDateParts = (todayParts, timeZone, hemisphere, season) => {
  const currentYear = getSeasonDatePartsForYear(
    todayParts.year,
    timeZone,
    hemisphere
  );
  let target = currentYear[season];
  if (compareDateParts(target, todayParts) < 0) {
    const nextYear = getSeasonDatePartsForYear(
      todayParts.year + 1,
      timeZone,
      hemisphere
    );
    target = nextYear[season];
  }
  return target;
};

const getPreviousSeasonDateParts = (todayParts, timeZone, hemisphere, season) => {
  const currentYear = getSeasonDatePartsForYear(
    todayParts.year,
    timeZone,
    hemisphere
  );
  let target = currentYear[season];
  if (compareDateParts(target, todayParts) > 0) {
    const previousYear = getSeasonDatePartsForYear(
      todayParts.year - 1,
      timeZone,
      hemisphere
    );
    target = previousYear[season];
  }
  return target;
};

const getAverageDaylightForMonths = (observer, timeZone, months) => {
  let total = 0;
  let count = 0;
  months.forEach(({ year, month }) => {
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const daylight = getDaylightMinutesForDateParts(observer, timeZone, {
        year,
        month,
        day,
      });
      if (daylight != null) {
        total += daylight;
        count += 1;
      }
    }
  });
  return count ? total / count : null;
};

const getAverageWinterDaylight = (
  observer,
  timeZone,
  winterSolsticeParts,
  hemisphere
) => {
  if (!winterSolsticeParts) {
    return null;
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
  return getAverageDaylightForMonths(observer, timeZone, months);
};

const getDaysUntilSunsetAfter = (
  observer,
  timeZone,
  todayParts,
  todaySunsetMinutes,
  targetMinutes
) => {
  if (todaySunsetMinutes == null) {
    return null;
  }
  if (todaySunsetMinutes >= targetMinutes) {
    return 0;
  }
  const match = findNextSunsetThreshold(
    observer,
    timeZone,
    todayParts,
    targetMinutes
  );
  return match ? match.offsetDays : null;
};

const getWeeksWithSunsetAfter = (
  observer,
  timeZone,
  startDateParts,
  targetMinutes,
  limitDays = 370
) => {
  let days = 0;
  for (let offset = 0; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startDateParts, offset);
    const { sunset } = getSunEvents(observer, timeZone, dateParts);
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

const getDaylightDailyGainThisWeekMin = (observer, timeZone, todayParts) => {
  let minGain = null;
  let previousDaylight = null;
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dateParts = addDaysToDateParts(todayParts, -offset);
    const daylight = getDaylightMinutesForDateParts(
      observer,
      timeZone,
      dateParts
    );
    if (daylight == null) {
      return null;
    }
    if (previousDaylight != null) {
      const gain = daylight - previousDaylight;
      if (minGain == null || gain < minGain) {
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

const formatTimeFromMinutes = (minutes, dateParts, timeZone) => {
  const hour = Math.floor(minutes / 60);
  const minute = Math.round(minutes % 60);
  const date = zonedTimeToUtc(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    hour,
    minute,
    0,
    timeZone
  );
  return formatTime(date, timeZone);
};

const findNextSunsetThreshold = (
  observer,
  timeZone,
  startDateParts,
  targetMinutes,
  limitDays = 370
) => {
  for (let offset = 1; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startDateParts, offset);
    const { sunset } = getSunEvents(observer, timeZone, dateParts);
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

const getOffsetMinutesForDateParts = (dateParts, timeZone) => {
  if (!dateParts) {
    return null;
  }
  const date = zonedTimeToUtc(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    12,
    0,
    0,
    timeZone
  );
  return getTimeZoneOffsetMinutes(date, timeZone);
};

const findNextDaylightSavingsStart = (
  timeZone,
  startParts,
  limitDays = 370
) => {
  if (!timeZone || !startParts) {
    return null;
  }
  const previousDay = addDaysToDateParts(startParts, -1);
  let previousOffset = getOffsetMinutesForDateParts(previousDay, timeZone);
  if (!Number.isFinite(previousOffset)) {
    return null;
  }
  for (let offset = 0; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startParts, offset);
    const offsetMinutes = getOffsetMinutesForDateParts(dateParts, timeZone);
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

const findFirstSunsetAfter = (
  observer,
  timeZone,
  startParts,
  targetMinutes,
  limitDays = 370
) => {
  if (!observer || !timeZone || !startParts) {
    return null;
  }
  const startSunset = getSunsetMinutesForDateParts(
    observer,
    timeZone,
    startParts
  );
  if (startSunset == null || startSunset >= targetMinutes) {
    return null;
  }
  for (let offset = 1; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startParts, offset);
    const sunsetMinutes = getSunsetMinutesForDateParts(
      observer,
      timeZone,
      dateParts
    );
    if (sunsetMinutes == null) {
      continue;
    }
    if (sunsetMinutes >= targetMinutes) {
      return { dateParts, offsetDays: offset };
    }
  }
  return null;
};

const findFirstDaylightAtLeast = (
  observer,
  timeZone,
  startParts,
  targetMinutes,
  limitDays = 370
) => {
  if (!observer || !timeZone || !startParts) {
    return null;
  }
  const startDaylight = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    startParts
  );
  if (startDaylight == null || startDaylight >= targetMinutes) {
    return null;
  }
  for (let offset = 1; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startParts, offset);
    const daylight = getDaylightMinutesForDateParts(
      observer,
      timeZone,
      dateParts
    );
    if (daylight == null) {
      continue;
    }
    if (daylight >= targetMinutes) {
      return { dateParts, offsetDays: offset };
    }
  }
  return null;
};

const findFirstDaylightGain = (
  observer,
  timeZone,
  startParts,
  gainMinutes,
  limitDays = 370
) => {
  if (!observer || !timeZone || !startParts) {
    return null;
  }
  const startDaylight = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    startParts
  );
  if (startDaylight == null) {
    return null;
  }
  for (let offset = 1; offset <= limitDays; offset += 1) {
    const dateParts = addDaysToDateParts(startParts, offset);
    const daylight = getDaylightMinutesForDateParts(
      observer,
      timeZone,
      dateParts
    );
    if (daylight == null) {
      continue;
    }
    if (daylight - startDaylight >= gainMinutes) {
      return { dateParts, offsetDays: offset };
    }
  }
  return null;
};

const buildMilestone = ({
  id,
  title,
  dateParts,
  todayHeadline,
  todayLede,
}) => {
  if (!dateParts) {
    return null;
  }
  return { id, title, dateParts, todayHeadline, todayLede };
};

const withMilestoneOffset = (milestone, todayParts) => {
  if (!milestone || !todayParts) {
    return null;
  }
  const offsetDays = getDaysBetweenDateParts(todayParts, milestone.dateParts);
  if (!Number.isFinite(offsetDays)) {
    return null;
  }
  return { ...milestone, offsetDays };
};

const formatMilestoneAway = (offsetDays) => {
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

const getMilestoneKey = (milestone) => {
  if (!milestone) {
    return "";
  }
  const dateStamp = formatDateInputValue(milestone.dateParts);
  return `${milestone.id || milestone.title}:${dateStamp}`;
};

const getMilestoneTodayCopy = (milestone) => {
  if (!milestone) {
    return null;
  }
  return {
    headline: milestone.todayHeadline || `${milestone.title} is today.`,
    lede: milestone.todayLede || "Enjoy the moment!",
  };
};

const updateMilestoneCard = (milestones, timeZone, { resetIndex = true } = {}) => {
  upcomingMilestones = milestones;
  if (resetIndex) {
    milestoneIndex = 0;
  } else if (milestoneIndex >= milestones.length) {
    milestoneIndex = 0;
  }
  milestoneTimeZone = timeZone;
  if (!nextHeadline || !nextDate || !nextAway) {
    return;
  }
  if (!milestones.length) {
    setText(nextHeadline, "No upcoming milestones");
    setText(nextDate, "—");
    setText(nextAway, "");
    if (milestone) {
      milestone.setAttribute("aria-label", "Upcoming milestone");
    }
    if (milestoneToggle) {
      milestoneToggle.disabled = true;
      milestoneToggle.setAttribute("aria-label", "Next milestone");
    }
    return;
  }
  const active = milestones[milestoneIndex];
  setText(nextHeadline, active.title);
  setText(nextDate, formatLongDateFromParts(active.dateParts, timeZone));
  setText(nextAway, formatMilestoneAway(active.offsetDays));
  if (milestone) {
    milestone.setAttribute("aria-label", `Upcoming milestone: ${active.title}`);
  }
  if (milestoneToggle) {
    const hasMultiple = milestones.length > 1;
    milestoneToggle.disabled = !hasMultiple;
    milestoneToggle.setAttribute(
      "aria-label",
      hasMultiple
        ? `Next milestone (${milestoneIndex + 1} of ${milestones.length})`
        : "Next milestone"
    );
  }
};

const celebrateMilestone = (milestone) => {
  if (!milestone) {
    lastCelebratedKey = null;
    return;
  }
  const key = getMilestoneKey(milestone);
  if (!key) {
    lastCelebratedKey = null;
    return;
  }
  if (key !== lastCelebratedKey) {
    lastCelebratedKey = key;
    launchConfetti();
  }
};

const updateDaylightForLocation = (location) => {
  if (!window.Astronomy || !location) {
    return;
  }
  const timeZone = location.timezone || FALLBACK_TIMEZONE;
  const observer = new Astronomy.Observer(
    location.latitude,
    location.longitude,
    location.elevation || 0
  );
  const hemisphere = location.latitude < 0 ? "south" : "north";
  const todayParts = getActiveDateParts(timeZone);
  syncDatePicker(timeZone);
  const weekParts = addDaysToDateParts(todayParts, -7);
  const monthParts = addMonthsToDateParts(todayParts, -1);

  const todayEvents = getSunEvents(observer, timeZone, todayParts);
  const weekEvents = getSunEvents(observer, timeZone, weekParts);
  const monthEvents = getSunEvents(observer, timeZone, monthParts);

  setText(
    sunsetTimeValue,
    todayEvents.sunset
      ? formatTime(todayEvents.sunset.date, timeZone)
      : "—"
  );

  const todaySunsetMinutes = todayEvents.sunset
    ? getMinutesSinceMidnight(todayEvents.sunset.date, timeZone)
    : null;
  const weekSunsetMinutes = weekEvents.sunset
    ? getMinutesSinceMidnight(weekEvents.sunset.date, timeZone)
    : null;
  const monthSunsetMinutes = monthEvents.sunset
    ? getMinutesSinceMidnight(monthEvents.sunset.date, timeZone)
    : null;
  const todayDaylight = getDaylightMinutes(todayEvents);
  const weekDaylight = getDaylightMinutes(weekEvents);
  const monthDaylight = getDaylightMinutes(monthEvents);
  const referenceYear = todayParts.year;
  const {
    earliestSunsetMinutes,
    earliestSunsetDateParts,
    shortestDayMinutes,
    shortestDayDateParts,
    longestDayMinutes,
    longestDayDateParts,
    maxDailyGainDateParts,
    daysWithLessDaylight,
  } = getYearlySunExtremes(observer, timeZone, todayParts.year, todayDaylight);

  const sunsetEarliestDelta =
    todaySunsetMinutes != null && earliestSunsetMinutes != null
      ? todaySunsetMinutes - earliestSunsetMinutes
      : null;
  const sunsetWeekDelta =
    todaySunsetMinutes != null && weekSunsetMinutes != null
      ? todaySunsetMinutes - weekSunsetMinutes
      : null;
  const sunsetMonthDelta =
    todaySunsetMinutes != null && monthSunsetMinutes != null
      ? todaySunsetMinutes - monthSunsetMinutes
      : null;
  const daylightShortestDelta =
    todayDaylight != null && shortestDayMinutes != null
      ? todayDaylight - shortestDayMinutes
      : null;
  const daylightWeekDelta =
    todayDaylight != null && weekDaylight != null
      ? todayDaylight - weekDaylight
      : null;
  const daylightMonthDelta =
    todayDaylight != null && monthDaylight != null
      ? todayDaylight - monthDaylight
      : null;

  const isNegativeDelta = (value) => Number.isFinite(value) && value < 0;
  const monthHasNegative =
    isNegativeDelta(sunsetMonthDelta) || isNegativeDelta(daylightMonthDelta);
  const weekHasNegative =
    isNegativeDelta(sunsetWeekDelta) || isNegativeDelta(daylightWeekDelta);
  const comparisonMode = monthHasNegative
    ? weekHasNegative
      ? "none"
      : "week"
    : "month";
  const showComparison = comparisonMode !== "none";
  const comparisonLabel =
    comparisonMode === "week" ? "vs. 1 week ago" : "vs. 1 month ago";
  const sunsetComparisonDelta =
    comparisonMode === "week" ? sunsetWeekDelta : sunsetMonthDelta;
  const daylightComparisonDelta =
    comparisonMode === "week" ? daylightWeekDelta : daylightMonthDelta;

  setText(sunsetEarliestDeltaValue, formatDeltaMinutes(sunsetEarliestDelta));

  setText(
    daylightDurationValue,
    todayDaylight == null ? "—" : formatDuration(todayDaylight)
  );

  setText(daylightShortestDeltaValue, formatDeltaMinutes(daylightShortestDelta));

  if (sunsetMonthRow) {
    sunsetMonthRow.classList.toggle("is-hidden", !showComparison);
  }
  if (daylightMonthRow) {
    daylightMonthRow.classList.toggle("is-hidden", !showComparison);
  }

  if (showComparison) {
    setText(sunsetComparisonLabel, comparisonLabel);
    setText(daylightComparisonLabel, comparisonLabel);
    setText(sunsetMonthDeltaValue, formatDeltaMinutes(sunsetComparisonDelta));
    setText(daylightMonthDeltaValue, formatDeltaMinutes(daylightComparisonDelta));
  } else {
    setText(sunsetMonthDeltaValue, "");
    setText(daylightMonthDeltaValue, "");
  }

  const sunsetEarliestTooltip =
    earliestSunsetMinutes != null && earliestSunsetDateParts
      ? formatComparisonTooltip(
          formatTimeFromMinutes(
            earliestSunsetMinutes,
            earliestSunsetDateParts,
            timeZone
          ),
          earliestSunsetDateParts,
          timeZone,
          referenceYear
        )
      : "";
  const sunsetWeekTooltip = weekEvents.sunset
    ? formatComparisonTooltip(
        formatTime(weekEvents.sunset.date, timeZone),
        weekParts,
        timeZone,
        referenceYear
      )
    : "";
  const sunsetMonthTooltip = monthEvents.sunset
    ? formatComparisonTooltip(
        formatTime(monthEvents.sunset.date, timeZone),
        monthParts,
        timeZone,
        referenceYear
      )
    : "";
  const sunsetComparisonTooltip =
    comparisonMode === "week" ? sunsetWeekTooltip : sunsetMonthTooltip;

  updateDeltaRowTooltip(sunsetEarliestRow, sunsetEarliestTooltip);
  updateDeltaRowTooltip(
    sunsetMonthRow,
    showComparison ? sunsetComparisonTooltip : ""
  );

  const daylightShortestTooltip =
    shortestDayMinutes != null && shortestDayDateParts
      ? formatComparisonTooltip(
          formatDuration(shortestDayMinutes),
          shortestDayDateParts,
          timeZone,
          referenceYear
        )
      : "";
  const daylightWeekTooltip =
    weekDaylight != null
      ? formatComparisonTooltip(
          formatDuration(weekDaylight),
          weekParts,
          timeZone,
          referenceYear
        )
      : "";
  const daylightMonthTooltip =
    monthDaylight != null
      ? formatComparisonTooltip(
          formatDuration(monthDaylight),
          monthParts,
          timeZone,
          referenceYear
        )
      : "";

  updateDeltaRowTooltip(daylightShortestRow, daylightShortestTooltip);
  const daylightComparisonTooltip =
    comparisonMode === "week" ? daylightWeekTooltip : daylightMonthTooltip;
  updateDeltaRowTooltip(
    daylightMonthRow,
    showComparison ? daylightComparisonTooltip : ""
  );

  const startOfYearParts = { year: todayParts.year, month: 1, day: 1 };
  const sunsetStartOfYear = getSunsetMinutesForDateParts(
    observer,
    timeZone,
    startOfYearParts
  );
  const twoMonthsParts = addMonthsToDateParts(todayParts, -2);
  const twoMonthsDaylight = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    twoMonthsParts
  );
  const endOfMonthParts = {
    year: todayParts.year,
    month: todayParts.month,
    day: getDaysInMonth(todayParts.year, todayParts.month),
  };
  const daylightAtEndOfMonth = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    endOfMonthParts
  );
  const in14Parts = addDaysToDateParts(todayParts, 14);
  const daylightIn14Days = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    in14Parts
  );
  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterdayDaylight = getDaylightMinutesForDateParts(
    observer,
    timeZone,
    yesterdayParts
  );
  const daylightGainToday =
    todayDaylight != null && yesterdayDaylight != null
      ? todayDaylight - yesterdayDaylight
      : null;
  const daylightGainThisWeek =
    todayDaylight != null && weekDaylight != null
      ? todayDaylight - weekDaylight
      : null;
  const daylightLossThisWeek =
    todayDaylight != null && weekDaylight != null
      ? weekDaylight - todayDaylight
      : null;
  const daylightLossThisMonthRaw =
    monthDaylight != null && todayDaylight != null
      ? monthDaylight - todayDaylight
      : null;
  const daylightLossThisMonth =
    daylightLossThisMonthRaw != null && daylightLossThisMonthRaw > 0
      ? daylightLossThisMonthRaw
      : null;
  const daylightLossLastMonthRaw =
    twoMonthsDaylight != null && monthDaylight != null
      ? twoMonthsDaylight - monthDaylight
      : null;
  const daylightLossLastMonth =
    daylightLossLastMonthRaw != null && daylightLossLastMonthRaw > 0
      ? daylightLossLastMonthRaw
      : null;
  const daylightAfter5pm =
    todaySunsetMinutes != null
      ? Math.max(0, todaySunsetMinutes - 17 * 60)
      : null;
  const daysUntilSunsetAfter5pm = getDaysUntilSunsetAfter(
    observer,
    timeZone,
    todayParts,
    todaySunsetMinutes,
    17 * 60
  );
  const daysUntilSunsetAfter6pm = getDaysUntilSunsetAfter(
    observer,
    timeZone,
    todayParts,
    todaySunsetMinutes,
    18 * 60
  );
  const daysUntilSunsetAfter7pm = getDaysUntilSunsetAfter(
    observer,
    timeZone,
    todayParts,
    todaySunsetMinutes,
    19 * 60
  );
  const daysUntilMaxDailyGain = maxDailyGainDateParts
    ? getDaysBetweenDateParts(todayParts, maxDailyGainDateParts)
    : null;
  const currentSeasonParts = getSeasonDatePartsForYear(
    todayParts.year,
    timeZone,
    hemisphere
  );
  const previousSummerSolsticeParts = getPreviousSeasonDateParts(
    todayParts,
    timeZone,
    hemisphere,
    "summer"
  );
  const springEquinoxDate = getLocalNoonDateFromParts(
    currentSeasonParts.spring,
    timeZone
  );
  const summerSolsticeDate = getLocalNoonDateFromParts(
    previousSummerSolsticeParts,
    timeZone
  );
  const winterSolsticeDate = getLocalNoonDateFromParts(
    currentSeasonParts.winter,
    timeZone
  );
  const daysUntilSummerSolsticeRaw = currentSeasonParts.summer
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.summer)
    : null;
  const daysUntilSummerSolstice =
    daysUntilSummerSolsticeRaw != null && daysUntilSummerSolsticeRaw > 0
      ? daysUntilSummerSolsticeRaw
      : null;
  const daysUntilWinterSolsticeRaw = currentSeasonParts.winter
    ? getDaysBetweenDateParts(todayParts, currentSeasonParts.winter)
    : null;
  const daysUntilWinterSolstice =
    daysUntilWinterSolsticeRaw != null && daysUntilWinterSolsticeRaw > 0
      ? daysUntilWinterSolsticeRaw
      : null;
  const daysUntilEarliestSunset = earliestSunsetDateParts
    ? getDaysBetweenDateParts(todayParts, earliestSunsetDateParts)
    : null;
  const daysInYear = getDaysInYear(todayParts.year);
  let fractionOfLossCompleted = null;
  if (
    todayDaylight != null &&
    Number.isFinite(longestDayMinutes) &&
    Number.isFinite(shortestDayMinutes)
  ) {
    const totalLoss = longestDayMinutes - shortestDayMinutes;
    if (totalLoss > 0) {
      fractionOfLossCompleted = clampValue(
        (longestDayMinutes - todayDaylight) / totalLoss,
        0,
        1
      );
    }
  }
  const weeksWithSunsetAfter7pmRemaining =
    todaySunsetMinutes != null
      ? getWeeksWithSunsetAfter(observer, timeZone, todayParts, 19 * 60)
      : null;
  const averageWinterDaylight = getAverageWinterDaylight(
    observer,
    timeZone,
    currentSeasonParts.winter,
    hemisphere
  );
  const todayDate = getLocalNoonDateFromParts(todayParts, timeZone);
  const earliestSunsetDate = getLocalNoonDateFromParts(
    earliestSunsetDateParts,
    timeZone
  );
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
    daylight_daily_gain_this_week_min: getDaylightDailyGainThisWeekMin(
      observer,
      timeZone,
      todayParts
    ),
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

  updateOptimisticMessage(messageData, todayParts.month, hemisphere);

  const milestoneCandidates = [];
  const addMilestone = (milestone) => {
    if (milestone) {
      milestoneCandidates.push(milestone);
    }
  };
  let nextYearExtremes = null;
  const resolveNextExtreme = (key) => {
    const current = {
      earliestSunsetDateParts,
      shortestDayDateParts,
      longestDayDateParts,
    }[key];
    if (current && compareDateParts(current, todayParts) >= 0) {
      return current;
    }
    if (!nextYearExtremes) {
      nextYearExtremes = getYearlySunExtremes(
        observer,
        timeZone,
        todayParts.year + 1,
        null
      );
    }
    return nextYearExtremes[key] || null;
  };

  const previousWinterSolsticeParts = getPreviousSeasonDateParts(
    todayParts,
    timeZone,
    hemisphere,
    "winter"
  );
  const sunsetThresholdMatches = SUNSET_THRESHOLD_MILESTONES.map(
    (milestoneConfig) => ({
      ...milestoneConfig,
      match: findFirstSunsetAfter(
        observer,
        timeZone,
        previousWinterSolsticeParts,
        milestoneConfig.minutes
      ),
    })
  );

  if (todaySunsetMinutes != null) {
    const targetMinutes = getNextHalfHour(todaySunsetMinutes);
    const targetLabel = formatTimeFromMinutes(
      targetMinutes,
      todayParts,
      timeZone
    );
    const milestoneMatch = findNextSunsetThreshold(
      observer,
      timeZone,
      todayParts,
      targetMinutes
    );
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
      dateParts: getNextSeasonDateParts(
        todayParts,
        timeZone,
        hemisphere,
        "spring"
      ),
      todayHeadline: "It's the spring equinox today.",
      todayLede: null,
    })
  );
  addMilestone(
    buildMilestone({
      id: "dst-start",
      title: "Daylight savings time starts",
      dateParts: findNextDaylightSavingsStart(timeZone, todayParts),
      todayHeadline: "Daylight savings time starts today.",
      todayLede: "Don't forget to spring forward.",
    })
  );

  const firstTwelveHours = findFirstDaylightAtLeast(
    observer,
    timeZone,
    previousWinterSolsticeParts,
    12 * 60
  );
  addMilestone(
    buildMilestone({
      id: "first-12-hours",
      title: "First day with exactly 12 hours of daylight",
      dateParts: firstTwelveHours?.dateParts,
      todayHeadline: "Today has exactly 12 hours of daylight.",
      todayLede: "A perfect balance of day and night.",
    })
  );

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
    const match = findFirstDaylightGain(
      observer,
      timeZone,
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
    .map((milestoneItem) => withMilestoneOffset(milestoneItem, todayParts))
    .filter(Boolean);
  const todayMilestone = milestoneOffsets.find(
    (milestoneItem) => milestoneItem.offsetDays === 0
  );
  if (todayMilestone) {
    const todayCopy = getMilestoneTodayCopy(todayMilestone);
    if (todayCopy) {
      setText(headline, todayCopy.headline);
      setText(lede, todayCopy.lede);
    }
    celebrateMilestone(todayMilestone);
  } else {
    celebrateMilestone(null);
  }

  const upcoming = milestoneOffsets
    .filter((milestoneItem) => milestoneItem.offsetDays > 0)
    .sort((a, b) => {
      const dayDiff = a.offsetDays - b.offsetDays;
      if (dayDiff !== 0) {
        return dayDiff;
      }
      return a.title.localeCompare(b.title);
    });
  updateMilestoneCard(upcoming, timeZone);
};

const US_STATE_ABBR = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const US_STATE_NAME_BY_ABBR = Object.fromEntries(
  Object.entries(US_STATE_ABBR).map(([name, abbr]) => [
    abbr.toLowerCase(),
    name,
  ])
);

const STATE_ALIAS_BY_TOKEN = {
  dc: "District of Columbia",
};

const formatSelectedLocation = (item) => {
  const isUnitedStates =
    normalizeCountryCode(item) === "US" ||
    item.country?.toLowerCase() === "united states";
  const regionName = item.admin1 || "";
  const region =
    isUnitedStates && US_STATE_ABBR[regionName]
      ? US_STATE_ABBR[regionName]
      : regionName;
  const parts = isUnitedStates
    ? [item.name, region]
    : [item.name, region, item.country];
  return parts.filter(Boolean).join(", ");
};

const formatSuggestionLocation = (item) => {
  const isUnitedStates =
    normalizeCountryCode(item) === "US" ||
    item.country?.toLowerCase() === "united states";
  const regionName = item.admin1 || "";
  const region =
    isUnitedStates && US_STATE_ABBR[regionName]
      ? US_STATE_ABBR[regionName]
      : regionName;
  const parts = [item.name, region, item.country].filter(Boolean);
  return parts.join(", ");
};

const normalizeCountryCode = (item) =>
  (item.country_code || "").toUpperCase();

const normalizeToken = (value) =>
  value.replace(/[^a-z0-9]/gi, "").toLowerCase();

const expandFilterTokens = (tokens) => {
  const expanded = new Set();
  tokens.forEach((token) => {
    const normalized = normalizeToken(token);
    if (!normalized) {
      return;
    }
    expanded.add(normalized);
    const alias = STATE_ALIAS_BY_TOKEN[normalized];
    if (alias) {
      expanded.add(normalizeToken(alias));
    }
    const stateName = US_STATE_NAME_BY_ABBR[normalized];
    if (stateName) {
      expanded.add(normalizeToken(stateName));
    }
  });
  return [...expanded];
};

const formatFilterTokens = (tokens) =>
  tokens
    .map((token) => (token.length === 2 ? token.toUpperCase() : token))
    .join(" ");

const parseQuery = (query) => {
  const parts = query.split(",");
  const name = (parts[0] || "").trim();
  const filterText = parts.slice(1).join(" ").trim();
  let tokens = filterText
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);
  let nameQuery = name || query;
  if (!tokens.length) {
    const words = name.split(/\s+/).filter(Boolean);
    const lastToken = normalizeToken(words[words.length - 1] || "");
    if (words.length > 1 && US_STATE_NAME_BY_ABBR[lastToken]) {
      tokens = [lastToken];
      nameQuery = words.slice(0, -1).join(" ");
    }
  }
  return {
    nameQuery: nameQuery || query,
    filterTokens: expandFilterTokens(tokens),
    rawFilterTokens: tokens,
  };
};

const normalizeNameValue = (value) => normalizeToken(value);

const isNameMatch = (item, nameQuery) => {
  if (!nameQuery) {
    return true;
  }
  const normalizedQuery = normalizeNameValue(nameQuery);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeNameValue(item.name || "").startsWith(normalizedQuery);
};

const matchesToken = (item, token) => {
  if (!token) {
    return true;
  }
  const fields = [item.admin1, item.admin2, item.country].filter(Boolean);
  const normalizedFields = fields.map((field) => normalizeNameValue(field));
  if (normalizedFields.some((field) => field.startsWith(token))) {
    return true;
  }
  const wordMatch = fields.some((field) =>
    field
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => word.startsWith(token))
  );
  if (wordMatch) {
    return true;
  }
  const stateMatch = fields.some(
    (field) => US_STATE_ABBR[field] === token.toUpperCase()
  );
  if (stateMatch) {
    return true;
  }
  const countryCode = (item.country_code || "").toLowerCase();
  return countryCode ? countryCode.startsWith(token) : false;
};

const applyFilterTokens = (items, tokens) => {
  if (!tokens.length) {
    return items;
  }
  return items.filter((item) =>
    tokens.every((token) => matchesToken(item, token))
  );
};

const updateClearButton = () => {
  if (!cityInput || !clearButton) {
    return;
  }
  const hasValue = cityInput.value.trim().length > 0;
  clearButton.classList.toggle("is-visible", hasValue);
};

const updateGeolocateButton = () => {
  if (!geolocateButton) {
    return;
  }
  if (!CAN_USE_GEOLOCATION) {
    geolocateButton.disabled = true;
    geolocateButton.title = "Location unavailable";
    return;
  }
  geolocateButton.disabled = locationBiasLoading;
  geolocateButton.title = locationBiasLoading ? "Locating..." : "Use my location";
};

const loadRecentLocations = () => {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to load recent locations:", error);
    return [];
  }
};

const loadStoredLocation = () => {
  try {
    const stored = localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Unable to load stored location:", error);
    return null;
  }
};

const saveStoredLocation = (location) => {
  try {
    localStorage.setItem(
      ACTIVE_LOCATION_STORAGE_KEY,
      JSON.stringify(location)
    );
  } catch (error) {
    console.warn("Unable to save stored location:", error);
  }
};

const isCurrentLocation = (location) => Boolean(location?.isCurrent);

const saveRecentLocations = (items) => {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Unable to save recent locations:", error);
  }
};

const updateRecentLocations = (item) => {
  const updated = [
    item,
    ...recentLocations.filter(
      (entry) =>
        entry.name !== item.name ||
        entry.admin1 !== item.admin1 ||
        entry.country_code !== item.country_code
    ),
  ].slice(0, MAX_RECENTS);
  recentLocations = updated;
  saveRecentLocations(updated);
};

const showRecentResults = () => {
  if (!recentLocations.length) {
    clearResults();
    return;
  }
  const statusMessages = [
    { text: "Recent locations.", type: "hint" },
  ];
  const groups = [
    {
      label: "Recent",
      items: recentLocations,
    },
  ];
  renderResults(groups, {
    statusMessages,
    actions: getActionItems(),
    emptyMessage: "No recent locations yet.",
  });
};

const setStatusMessages = (messages) => {
  if (!resultsMeta) {
    return;
  }
  resultsMeta.innerHTML = "";
  messages.forEach((message) => {
    const status = document.createElement("div");
    status.className = `location-status${
      message.type ? ` is-${message.type}` : ""
    }`;
    status.textContent = message.text;
    resultsMeta.appendChild(status);
  });
  if (resultsPanel?.classList.contains("is-open")) {
    updateResultsMaxHeight();
  }
};

const renderActions = (actions) => {
  if (!resultsActions) {
    return;
  }
  resultsActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `location-action${
      action.variant ? ` ${action.variant}` : ""
    }`;
    button.dataset.action = action.action;
    button.textContent = action.label;
    if (action.disabled) {
      button.disabled = true;
    }
    resultsActions.appendChild(button);
  });
  if (resultsPanel?.classList.contains("is-open")) {
    updateResultsMaxHeight();
  }
};

const openResultsPanel = () => {
  if (!resultsPanel || !cityInput) {
    return;
  }
  resultsPanel.classList.add("is-open");
  cityInput.setAttribute("aria-expanded", "true");
  updateResultsMaxHeight();
};

const getActionItems = ({ toggleLabel, includeRetry } = {}) => {
  const actions = [];
  if (toggleLabel) {
    actions.push({
      action: "toggle-preference",
      label: toggleLabel,
    });
  }
  if (includeRetry) {
    actions.push({
      action: "retry",
      label: "Retry search",
      variant: "is-secondary",
    });
  }
  return actions;
};

const groupResults = (results, nameQuery) => {
  const exactMatches = [];
  const nearbyMatches = [];
  results.forEach((item) => {
    if (isNameMatch(item, nameQuery)) {
      exactMatches.push(item);
    } else {
      nearbyMatches.push(item);
    }
  });
  const groups = [];
  if (exactMatches.length) {
    groups.push({
      label: nearbyMatches.length ? "Matches" : null,
      items: exactMatches,
    });
  }
  if (nearbyMatches.length) {
    groups.push({
      label: exactMatches.length ? "Nearby" : null,
      items: nearbyMatches,
    });
  }
  return groups;
};

const renderGroup = (group) => {
  if (!resultsList) {
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "location-group";
  wrapper.role = group.label ? "group" : "presentation";
  if (group.label) {
    wrapper.setAttribute("aria-label", group.label);
    const label = document.createElement("div");
    label.className = "location-group-label";
    label.textContent = group.label;
    label.setAttribute("aria-hidden", "true");
    wrapper.appendChild(label);
  }
  group.items.forEach((item) => {
    const index = suggestionResults.length;
    suggestionResults.push(item);
    const option = document.createElement("div");
    option.id = `location-option-${index}`;
    option.className = "location-option";
    option.role = "option";
    option.tabIndex = -1;
    option.dataset.index = String(index);
    option.textContent = formatSuggestionLocation(item);
    wrapper.appendChild(option);
  });
  resultsList.appendChild(wrapper);
};

const showLoadingState = () => {
  suggestionResults = [];
  activeIndex = -1;
  if (!resultsList || !cityInput) {
    return;
  }
  resultsList.innerHTML = "";
  cityInput.removeAttribute("aria-activedescendant");
  setStatusMessages([{ text: "Searching for cities...", type: "hint" }]);
  renderActions(getActionItems());
  openResultsPanel();
};

const showErrorState = () => {
  suggestionResults = [];
  activeIndex = -1;
  if (!resultsList || !cityInput) {
    return;
  }
  resultsList.innerHTML = "";
  cityInput.removeAttribute("aria-activedescendant");
  setStatusMessages([
    {
      text: "Could not fetch city suggestions. Check your connection and try again.",
      type: "error",
    },
  ]);
  renderActions(getActionItems({ includeRetry: true }));
  openResultsPanel();
};

const buildCurrentLocation = (coords) => ({
  name: "Current location",
  admin1: "",
  admin2: "",
  country: "",
  country_code: "",
  latitude: coords.lat,
  longitude: coords.lon,
  elevation: 0,
  timezone: FALLBACK_TIMEZONE,
  isCurrent: true,
});

const selectLocationFromCoords = (coords) => {
  selectResult(buildCurrentLocation(coords));
};

const requestLocationBias = ({ onError } = {}) => {
  if (locationBiasRequested || !("geolocation" in navigator)) {
    return;
  }
  locationBiasRequested = true;
  locationBiasLoading = true;
  updateGeolocateButton();
  renderActions(getActionItems());
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      selectLocationFromCoords(userCoords);
      locationBiasLoading = false;
      locationBiasRequested = false;
      updateGeolocateButton();
    },
    (error) => {
      locationBiasLoading = false;
      locationBiasRequested = false;
      updateGeolocateButton();
      renderActions(getActionItems());
      if (typeof onError === "function") {
        onError(error);
      }
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
};

recentLocations = loadRecentLocations();

const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
};

const sortByDistance = (items) => {
  if (!userCoords) {
    return items;
  }
  return [...items].sort((a, b) => {
    const distanceA = distanceKm(
      userCoords.lat,
      userCoords.lon,
      a.latitude,
      a.longitude
    );
    const distanceB = distanceKm(
      userCoords.lat,
      userCoords.lon,
      b.latitude,
      b.longitude
    );
    return distanceA - distanceB;
  });
};

const clearResults = () => {
  suggestionResults = [];
  rawResults = [];
  activeIndex = -1;
  if (!resultsList || !resultsMeta || !resultsActions || !resultsPanel || !cityInput) {
    return;
  }
  resultsList.innerHTML = "";
  resultsMeta.innerHTML = "";
  resultsActions.innerHTML = "";
  resultsPanel.classList.remove("is-open");
  cityInput.setAttribute("aria-expanded", "false");
  cityInput.removeAttribute("aria-activedescendant");
  resultsList.style.maxHeight = "";
};

const updateResultsMaxHeight = () => {
  if (!resultsPanel || !cityInput || !resultsList) {
    return;
  }
  if (!resultsPanel.classList.contains("is-open")) {
    return;
  }
  const locationRect = cityInput.getBoundingClientRect();
  const milestoneRect = milestone?.getBoundingClientRect();
  const spacing = 12;
  const available =
    milestoneRect && milestoneRect.top > locationRect.bottom + spacing
      ? milestoneRect.top - locationRect.bottom - spacing
      : window.innerHeight - locationRect.bottom - spacing;
  const chromeHeight =
    (resultsMeta?.offsetHeight || 0) + (resultsActions?.offsetHeight || 0) + 24;
  const maxHeight = Math.max(0, Math.min(260, available - chromeHeight));
  resultsList.style.maxHeight = `${maxHeight}px`;
};

const renderResults = (groups, options = {}) => {
  if (!resultsList || !cityInput) {
    return;
  }
  resultsList.innerHTML = "";
  suggestionResults = [];
  activeIndex = -1;

  const statusMessages = [...(options.statusMessages || [])];
  const hasItems = groups.some((group) => group.items.length);
  if (!hasItems && options.emptyMessage) {
    statusMessages.push({ text: options.emptyMessage, type: "hint" });
  }
  setStatusMessages(statusMessages);
  renderActions(options.actions || []);

  if (hasItems) {
    groups.forEach(renderGroup);
  }

  openResultsPanel();

  if (hasItems) {
    updateActiveOption(0);
  } else {
    cityInput.removeAttribute("aria-activedescendant");
  }
};

const buildResults = (
  results,
  filterTokens = lastFilterTokens,
  rawTokens = lastFilterTokensRaw
) => {
  rawResults = results;
  const filteredResults = applyFilterTokens(results, filterTokens);
  const effectiveResults = filteredResults.length
    ? filteredResults
    : results;
  const localResults = regionCode
    ? effectiveResults.filter(
        (item) => normalizeCountryCode(item) === regionCode
      )
    : [];
  const otherResults = regionCode
    ? effectiveResults.filter(
        (item) => normalizeCountryCode(item) !== regionCode
      )
    : effectiveResults;
  const sortedLocal = sortByDistance(localResults);
  const sortedAll = sortByDistance(effectiveResults);
  const filterHint =
    rawTokens.length && !filteredResults.length
      ? `No matches for "${formatFilterTokens(
          rawTokens
        )}". Showing broader results.`
      : null;
  const localityLabel = userCoords ? "nearby" : "local";
  let displayResults = sortedAll;
  let toggleLabel = null;
  const statusMessages = [];

  if (preferLocalResults && sortedLocal.length) {
    displayResults = sortedLocal;
    toggleLabel = otherResults.length ? "Show worldwide results" : null;
  } else if (preferLocalResults && !sortedLocal.length && regionCode) {
    displayResults = sortedAll;
    statusMessages.push({
      text: `No ${localityLabel} matches. Showing worldwide results.`,
      type: "hint",
    });
  } else {
    displayResults = sortedAll;
    if (sortedLocal.length && otherResults.length) {
      toggleLabel = userCoords ? "Prefer nearby results" : "Prefer local results";
      statusMessages.push({
        text: "Showing worldwide results.",
        type: "hint",
      });
    }
  }

  if (filterHint) {
    statusMessages.unshift({ text: filterHint, type: "hint" });
  }

  const groups = groupResults(
    displayResults.slice(0, MAX_RESULTS),
    lastNameQuery
  );
  renderResults(groups, {
    statusMessages,
    actions: getActionItems({ toggleLabel }),
    emptyMessage: "No matches yet.",
  });
};

const selectResult = (item, { persist = true, updateRecents = true } = {}) => {
  const label = formatSelectedLocation(item);
  setInputValue(cityInput, label);
  if (updateRecents) {
    updateRecentLocations(item);
  }
  if (persist) {
    saveStoredLocation(item);
  }
  updateClearButton();
  clearResults();
  activeLocation = item;
  updateDaylightForLocation(item);
  console.log(`Selected city: ${label}`, {
    latitude: item.latitude,
    longitude: item.longitude,
  });
};

const updateActiveOption = (nextIndex) => {
  if (!resultsList || !cityInput) {
    return;
  }
  const options = resultsList.querySelectorAll(".location-option");
  if (!options.length) {
    activeIndex = -1;
    cityInput.removeAttribute("aria-activedescendant");
    return;
  }
  activeIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
  options.forEach((option, index) => {
    const isActive = index === activeIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");
    option.tabIndex = isActive ? 0 : -1;
    if (isActive) {
      cityInput.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }
  });
};

const mapGeocodingResults = (data) =>
  (data.results || []).map((item) => ({
    name: item.name,
    admin1: item.admin1,
    admin2: item.admin2,
    country: item.country,
    country_code: item.country_code,
    latitude: item.latitude,
    longitude: item.longitude,
    elevation: item.elevation,
    timezone: item.timezone,
  }));

const fetchSuggestions = async (nameQuery, filterTokens, rawTokens) => {
  if (fetchController) {
    fetchController.abort();
  }
  fetchController = new AbortController();
  showLoadingState();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    nameQuery
  )}&count=20&language=${encodeURIComponent(
    languageCode
  )}&format=json`;
  try {
    const response = await fetch(url, { signal: fetchController.signal });
    if (!response.ok) {
      throw new Error("Failed to fetch city suggestions.");
    }
    const data = await response.json();
    const results = mapGeocodingResults(data);
    buildResults(results, filterTokens, rawTokens);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("City lookup failed:", error);
    showErrorState();
  }
};

const fetchDefaultLocation = async () => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    DEFAULT_LOCATION_QUERY
  )}&count=10&language=${encodeURIComponent(
    languageCode
  )}&format=json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch default location.");
    }
    const data = await response.json();
    const results = mapGeocodingResults(data);
    const match =
      results.find(
        (item) =>
          (item.name || "").toLowerCase() === "boston" &&
          normalizeCountryCode(item) === "US" &&
          (item.admin1 || "").toLowerCase() === "massachusetts"
      ) ||
      results.find(
        (item) =>
          (item.name || "").toLowerCase() === "boston" &&
          normalizeCountryCode(item) === "US"
      ) ||
      results[0];
    if (match) {
      selectResult(match, { persist: false, updateRecents: false });
      return;
    }
    selectResult(DEFAULT_LOCATION, { persist: false, updateRecents: false });
  } catch (error) {
    console.warn("Default location lookup failed:", error);
    selectResult(DEFAULT_LOCATION, { persist: false, updateRecents: false });
  }
};

const initializeLocation = () => {
  const storedLocation = loadStoredLocation();
  if (storedLocation) {
    if (isCurrentLocation(storedLocation)) {
      userCoords = {
        lat: storedLocation.latitude,
        lon: storedLocation.longitude,
      };
    }
    selectResult(storedLocation, { persist: false, updateRecents: false });
  }

  if (!CAN_USE_GEOLOCATION || !navigator.permissions?.query) {
    if (!storedLocation) {
      fetchDefaultLocation();
    }
    return;
  }

  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (status.state === "granted") {
        if (!storedLocation) {
          requestLocationBias({ onError: fetchDefaultLocation });
        }
      } else if (!storedLocation) {
        fetchDefaultLocation();
      }
    })
    .catch((error) => {
      console.warn("Unable to check geolocation permission:", error);
      if (!storedLocation) {
        fetchDefaultLocation();
      }
    });
};

const handleInput = () => {
  if (!cityInput) {
    return;
  }
  const query = cityInput.value.trim();
  lastQuery = query;
  const { nameQuery, filterTokens, rawFilterTokens } = parseQuery(query);
  lastNameQuery = nameQuery;
  lastFilterTokens = filterTokens;
  lastFilterTokensRaw = rawFilterTokens;
  updateClearButton();
  if (nameQuery.length < 2) {
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }
    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }
    if (recentLocations.length) {
      showRecentResults();
    } else {
      clearResults();
    }
    return;
  }
  if (debounceId) {
    clearTimeout(debounceId);
  }
  debounceId = window.setTimeout(() => {
    fetchSuggestions(nameQuery, filterTokens, rawFilterTokens);
  }, 250);
};

if (cityInput) {
  cityInput.addEventListener("input", handleInput);
  cityInput.addEventListener("focus", () => {
    handleInput();
  });
  cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearResults();
      return;
    }
    if (!suggestionResults.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateActiveOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateActiveOption(suggestionResults.length - 1);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        selectResult(suggestionResults[activeIndex]);
      } else if (suggestionResults.length) {
        event.preventDefault();
        selectResult(suggestionResults[0]);
      }
    }
  });
}

if (clearButton && cityInput) {
  clearButton.addEventListener("click", () => {
    setInputValue(cityInput, "");
    lastQuery = "";
    lastNameQuery = "";
    lastFilterTokens = [];
    lastFilterTokensRaw = [];
    updateClearButton();
    if (recentLocations.length) {
      showRecentResults();
    } else {
      clearResults();
    }
    cityInput.focus();
  });
}

if (geolocateButton && cityInput) {
  geolocateButton.addEventListener("click", () => {
    requestLocationBias();
    cityInput.focus();
  });
}

if (dateInput) {
  const handleDateCommitInput = () => {
    if (isRecentDateKeyboardInput()) {
      return;
    }
    scheduleDateCommit();
  };

  dateInput.addEventListener("input", handleDateCommitInput);
  dateInput.addEventListener("change", handleDateCommitInput);
  dateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitDateSelection();
      return;
    }
    if (
      event.key === "Tab" ||
      event.key === "Shift" ||
      event.key === "Alt" ||
      event.key === "Control" ||
      event.key === "Meta"
    ) {
      return;
    }
    lastDateKeydownAt = Date.now();
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("pointerdown", () => {
    lastDateKeydownAt = 0;
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("blur", () => {
    clearDateCommitTimeout();
    commitDateSelection();
  });
}

if (dateReset) {
  dateReset.addEventListener("click", () => {
    clearDateCommitTimeout();
    lastDateKeydownAt = 0;
    const didChange = applyDateSelection(null);
    const timeZone = activeLocation?.timezone || FALLBACK_TIMEZONE;
    syncDatePicker(timeZone);
    if (activeLocation && didChange) {
      updateDaylightForLocation(activeLocation);
    }
  });
}

if (milestoneToggle) {
  milestoneToggle.addEventListener("click", () => {
    if (!upcomingMilestones.length) {
      return;
    }
    milestoneIndex = (milestoneIndex + 1) % upcomingMilestones.length;
    updateMilestoneCard(
      upcomingMilestones,
      milestoneTimeZone || FALLBACK_TIMEZONE,
      { resetIndex: false }
    );
  });
}

if (resultsList) {
  resultsList.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const target = event.target.closest(".location-option");
    if (!target) {
      return;
    }
    const index = Number(target.dataset.index);
    const item = suggestionResults[index];
    if (item) {
      selectResult(item);
    }
  });

  resultsList.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const target = event.target.closest(".location-option");
    if (!target) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = Number(target.dataset.index);
      const item = suggestionResults[index];
      if (item) {
        selectResult(item);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(activeIndex + 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[activeIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(activeIndex - 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[activeIndex]?.focus();
    } else if (event.key === "Escape") {
      clearResults();
      cityInput?.focus();
    }
  });
}

if (resultsActions) {
  resultsActions.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action) {
      return;
    }
    const actionType = action.dataset.action;
    if (actionType === "toggle-preference") {
      preferLocalResults = !preferLocalResults;
      if (rawResults.length) {
        buildResults(rawResults, lastFilterTokens, lastFilterTokensRaw);
      }
    } else if (actionType === "geolocate") {
      requestLocationBias();
    } else if (actionType === "retry") {
      if (lastNameQuery.length >= 2) {
        fetchSuggestions(lastNameQuery, lastFilterTokens, lastFilterTokensRaw);
      } else {
        clearResults();
      }
    }
  });
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".location")) {
    clearResults();
  }
});

document.addEventListener("focusin", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".location")) {
    clearResults();
  }
});

window.addEventListener("resize", updateResultsMaxHeight);

syncDatePicker(FALLBACK_TIMEZONE);
updateGeolocateButton();
initializeLocation();

if (shareButton) {
  shareButton.addEventListener("click", () => {
    const headlineText = getText(headline) || "Sunshine Optimist";
    const ledeText = getText(lede);
    const message = `${headlineText}${ledeText ? ` ${ledeText}` : ""} — via Sunshine Optimist`;
    const writePromise = navigator.clipboard?.writeText(message);
    if (!writePromise) {
      return;
    }
    writePromise
      .then(() => {
        const label = shareButton.querySelector("span");
        if (!label) {
          return;
        }
        const previous = label.textContent;
        setText(label, "Copied!");
        setTimeout(() => setText(label, previous), 1200);
      })
      .catch((error) => {
        console.warn("Share failed:", error);
      });
  });
}
