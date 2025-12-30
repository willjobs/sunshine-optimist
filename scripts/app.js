import { getOptimisticMessageOptions } from "./messages.js";
import {
  DAYLIGHT_GAIN_MILESTONES,
  SUNSET_THRESHOLD_MILESTONES,
} from "./milestones.js";
import { createAstronomyContext } from "./astronomy-utils.js";
import {
  addDaysToDateParts,
  addMonthsToDateParts,
  compareDateParts,
  createDateFormatter,
  formatDateInputValue,
  getDaysBetweenDateParts,
  getDaysInMonth,
  getDaysInYear,
  getLocalDateParts,
  getLocalNoonDateFromParts,
  getMinutesSinceMidnight,
  parseDateInputValue,
} from "./date-utils.js";
import { getText, setInputValue, setText } from "./dom-utils.js";
import {
  applyFilterTokens,
  formatFilterTokensForHint,
  formatSelectedLocation,
  formatSuggestionLocation,
  isNameMatch,
  normalizeCountryCode,
  parseQuery,
  sortByDistance,
} from "./location-utils.js";
import {
  buildShareProgressLine,
  formatShareDateFromParts,
  formatShareDayCount,
  formatShareMinutes,
  lowerCaseFirstLetter,
} from "./share-utils.js";
import { clampValue } from "./utils.js";

const dom = {
  shareButton: document.getElementById("share"),
  shareModal: document.getElementById("share-modal"),
  shareModalClose: document.getElementById("share-modal-close"),
  sharePreview: document.getElementById("share-preview"),
  sharePrivacyToggle: document.getElementById("share-privacy-toggle"),
  shareActionButtons: document.querySelectorAll(
    ".share-icon-button[data-share], .share-copy-button[data-share]"
  ),
  headline: document.getElementById("headline"),
  lede: document.getElementById("lede"),
  cityInput: document.getElementById("city-input"),
  geolocateButton: document.getElementById("location-geolocate"),
  resultsPanel: document.getElementById("location-results"),
  resultsMeta: document.getElementById("location-results-meta"),
  resultsActions: document.getElementById("location-results-actions"),
  resultsList: document.getElementById("location-results-list"),
  clearButton: document.getElementById("location-clear"),
  milestone: document.querySelector(".milestone"),
  milestoneToggle: document.getElementById("milestone-toggle"),
  confettiRoot: document.getElementById("confetti"),
  sunsetTimeValue: document.getElementById("sunset-time"),
  sunsetEarliestDeltaValue: document.getElementById("sunset-earliest-delta"),
  sunsetComparisonDeltaValue: document.getElementById("sunset-month-delta"),
  daylightDurationValue: document.getElementById("daylight-duration"),
  daylightShortestDeltaValue: document.getElementById("daylight-shortest-delta"),
  daylightComparisonDeltaValue: document.getElementById("daylight-month-delta"),
  sunsetEarliestRow: document.getElementById("sunset-earliest-row"),
  sunsetComparisonRow: document.getElementById("sunset-month-row"),
  daylightShortestRow: document.getElementById("daylight-shortest-row"),
  daylightComparisonRow: document.getElementById("daylight-month-row"),
  sunsetEarliestReference: document.getElementById("sunset-earliest-reference"),
  sunsetComparisonReference: document.getElementById(
    "sunset-comparison-reference"
  ),
  daylightShortestReference: document.getElementById(
    "daylight-shortest-reference"
  ),
  daylightComparisonReference: document.getElementById(
    "daylight-comparison-reference"
  ),
  nextHeadline: document.getElementById("next-headline"),
  nextDate: document.getElementById("next-date"),
  nextAway: document.getElementById("next-away"),
  dateInput: document.getElementById("date-input"),
  dateReset: document.getElementById("date-reset"),
  datePicker: document.querySelector(".date-picker"),
};

const {
  shareButton,
  shareModal,
  shareModalClose,
  sharePreview,
  sharePrivacyToggle,
  shareActionButtons,
  headline,
  lede,
  cityInput,
  geolocateButton,
  resultsPanel,
  resultsMeta,
  resultsActions,
  resultsList,
  clearButton,
  milestone,
  milestoneToggle,
  confettiRoot,
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
  nextHeadline,
  nextDate,
  nextAway,
  dateInput,
  dateReset,
  datePicker,
} = dom;
const searchState = {
  suggestionResults: [],
  rawResults: [],
  activeIndex: -1,
  debounceId: null,
  fetchController: null,
  preferLocalResults: true,
  lastNameQuery: "",
  locationBiasRequested: false,
  locationBiasLoading: false,
  userCoords: null,
  lastFilterTokens: [],
  lastFilterTokensRaw: [],
  recentLocations: [],
  activeLocation: null,
};
const dateState = {
  useLiveDate: true,
  customDateParts: null,
  commitTimeoutId: null,
  lastKeydownAt: 0,
};
const milestoneState = {
  upcoming: [],
  index: 0,
  timeZone: null,
  lastCelebratedKey: null,
  confettiTimeoutId: null,
};
const optimisticState = {
  options: [],
  index: 0,
  rotationId: null,
  swapId: 0,
  swapTimeoutId: null,
};
const shareState = {
  snapshot: null,
  modalSnapshot: null,
  privacyEnabled: false,
  text: "",
};
const reverseGeocodeState = {
  cache: null,
  cacheKey: "",
  promise: null,
};
const localeSource = navigator.languages?.[0] || navigator.language || "en";
const languageCode = localeSource.split("-")[0] || "en";
const regionCode = (localeSource.split("-")[1] || "").toUpperCase();
const {
  formatLongDateFromParts,
  formatShortDateFromParts,
  formatTime,
  formatTimeFromMinutes,
} = createDateFormatter(localeSource);
const MAX_RESULTS = 8;
const MAX_RECENTS = 5;
const RECENT_STORAGE_KEY = "sunshine-optimist:recent-locations";
const ACTIVE_LOCATION_STORAGE_KEY = "sunshine-optimist:active-location";
const SHARE_PRIVACY_STORAGE_KEY = "sunshine-optimist:share-privacy";
const CAN_USE_GEOLOCATION = "geolocation" in navigator;
const DEFAULT_LOCATION_QUERY = "Boston";
const CURRENT_LOCATION_LABEL = "Current Location";
const REVERSE_GEOCODE_URL =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";
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

const getActiveDateParts = (timeZone) => {
  if (!dateState.useLiveDate && dateState.customDateParts) {
    return dateState.customDateParts;
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
    dateReset.disabled = dateState.useLiveDate;
  }
  if (datePicker) {
    datePicker.classList.toggle("is-custom", !dateState.useLiveDate);
  }
};

const clearDateCommitTimeout = () => {
  if (dateState.commitTimeoutId) {
    clearTimeout(dateState.commitTimeoutId);
    dateState.commitTimeoutId = null;
  }
};

const applyDateSelection = (nextParts) => {
  if (nextParts) {
    if (
      !dateState.useLiveDate &&
      dateState.customDateParts &&
      dateState.customDateParts.year === nextParts.year &&
      dateState.customDateParts.month === nextParts.month &&
      dateState.customDateParts.day === nextParts.day
    ) {
      return false;
    }
    dateState.customDateParts = nextParts;
    dateState.useLiveDate = false;
    return true;
  }
  if (dateState.useLiveDate) {
    return false;
  }
  dateState.customDateParts = null;
  dateState.useLiveDate = true;
  return true;
};

const commitDateSelection = () => {
  if (!dateInput) {
    return;
  }
  clearDateCommitTimeout();
  const nextParts = parseDateInputValue(dateInput.value);
  const didChange = applyDateSelection(nextParts);
  const timeZone = searchState.activeLocation?.timezone || FALLBACK_TIMEZONE;
  syncDatePicker(timeZone);
  if (searchState.activeLocation && didChange) {
    updateDaylightForLocation(searchState.activeLocation);
  }
};

const scheduleDateCommit = () => {
  clearDateCommitTimeout();
  dateState.commitTimeoutId = window.setTimeout(() => {
    dateState.commitTimeoutId = null;
    commitDateSelection();
  }, DATE_COMMIT_DELAY_MS);
};

const isRecentDateKeyboardInput = () =>
  Date.now() - dateState.lastKeydownAt < DATE_KEYBOARD_GRACE_MS;

const formatDuration = (minutes) => {
  const totalMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatDeltaStatement = (minutes, positiveLabel, negativeLabel) => {
  if (minutes == null || Number.isNaN(minutes)) {
    return "";
  }
  const rounded = Math.round(minutes);
  const abs = Math.abs(rounded);
  const value =
    abs >= 60 ? formatDuration(abs) : `${abs} ${abs === 1 ? "minute" : "minutes"}`;
  const descriptor = rounded >= 0 ? positiveLabel : negativeLabel;
  return `${value} ${descriptor}`;
};

const formatComparisonTooltip = (value, parts, timeZone, referenceYear) => {
  if (!value || !parts) {
    return "";
  }
  const dateLabel = formatShortDateFromParts(parts, timeZone, referenceYear);
  if (!dateLabel) {
    return "";
  }
  return `${value} on ${dateLabel}`;
};

const OPTIMISTIC_ROTATION_MS = 15000;
const OPTIMISTIC_OUT_CLASS = "is-optimistic-out";
const OPTIMISTIC_IN_CLASS = "is-optimistic-in";
const OPTIMISTIC_OUT_DURATION_MS = 320;
const OPTIMISTIC_POLAR_COPY = {
  headline: "Sunlight looks different here.",
  lede: "No sunrise or sunset today.",
};
const OPTIMISTIC_FALLBACK_COPY = {
  headline: "Enjoy the daylight today.",
  lede: "Every bit of sunshine helps.",
};

const clearOptimisticSwapTimeout = () => {
  if (optimisticState.swapTimeoutId) {
    window.clearTimeout(optimisticState.swapTimeoutId);
    optimisticState.swapTimeoutId = null;
  }
};

const clearOptimisticRotation = () => {
  if (optimisticState.rotationId) {
    window.clearInterval(optimisticState.rotationId);
    optimisticState.rotationId = null;
  }
};

const resetOptimisticAnimation = () => {
  clearOptimisticSwapTimeout();
  optimisticState.swapId += 1;
  [headline, lede].forEach((node) => {
    if (!node) {
      return;
    }
    node.classList.remove(OPTIMISTIC_OUT_CLASS, OPTIMISTIC_IN_CLASS);
  });
};

const stopOptimisticRotation = () => {
  clearOptimisticRotation();
  resetOptimisticAnimation();
  optimisticState.options = [];
  optimisticState.index = 0;
};

const prefersReducedMotion = () => {
  if (!window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const setOptimisticCopyImmediate = (copy) => {
  if (!copy) {
    return;
  }
  resetOptimisticAnimation();
  setText(headline, copy.headline);
  setText(lede, copy.lede);
};

const animateOptimisticSwap = (copy) => {
  if (!copy) {
    return;
  }
  if (!headline || !lede || prefersReducedMotion()) {
    setOptimisticCopyImmediate(copy);
    return;
  }
  resetOptimisticAnimation();
  const swapId = optimisticState.swapId;
  [headline, lede].forEach((node) => {
    if (!node) {
      return;
    }
    node.classList.remove(OPTIMISTIC_IN_CLASS);
    void node.offsetWidth;
    node.classList.add(OPTIMISTIC_OUT_CLASS);
  });
  optimisticState.swapTimeoutId = window.setTimeout(() => {
    if (swapId !== optimisticState.swapId) {
      return;
    }
    setText(headline, copy.headline);
    setText(lede, copy.lede);
    [headline, lede].forEach((node) => {
      if (!node) {
        return;
      }
      node.classList.remove(OPTIMISTIC_OUT_CLASS);
      void node.offsetWidth;
      node.classList.add(OPTIMISTIC_IN_CLASS);
    });
  }, OPTIMISTIC_OUT_DURATION_MS);
};

const setOptimisticCopy = (copy, { animate = false } = {}) => {
  if (!copy) {
    return;
  }
  if (!animate) {
    setOptimisticCopyImmediate(copy);
    return;
  }
  animateOptimisticSwap(copy);
};

const startOptimisticRotation = (messages) => {
  stopOptimisticRotation();
  optimisticState.options = Array.isArray(messages) ? messages : [];
  if (!optimisticState.options.length) {
    return;
  }
  optimisticState.index = 0;
  setOptimisticCopy(optimisticState.options[0], { animate: false });
  if (optimisticState.options.length < 2) {
    return;
  }
  optimisticState.rotationId = window.setInterval(() => {
    optimisticState.index =
      (optimisticState.index + 1) % optimisticState.options.length;
    setOptimisticCopy(optimisticState.options[optimisticState.index], {
      animate: true,
    });
  }, OPTIMISTIC_ROTATION_MS);
};

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
  if (milestoneState.confettiTimeoutId) {
    window.clearTimeout(milestoneState.confettiTimeoutId);
    milestoneState.confettiTimeoutId = null;
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
  milestoneState.confettiTimeoutId = window.setTimeout(() => {
    confettiRoot.innerHTML = "";
    milestoneState.confettiTimeoutId = null;
  }, (maxDuration + 0.5) * 1000);
};

const deltaTooltipTargets = [
  sunsetEarliestReference,
  sunsetComparisonReference,
  daylightShortestReference,
  daylightComparisonReference,
].filter(Boolean);

const closeDeltaTooltips = (exceptTarget = null) => {
  deltaTooltipTargets.forEach((target) => {
    if (target === exceptTarget) {
      return;
    }
    if (!target.classList.contains("is-tooltip-open")) {
      return;
    }
    target.classList.remove("is-tooltip-open");
    target.setAttribute("aria-expanded", "false");
  });
};

const buildDeltaTooltipAriaLabel = (target, tooltipText) => {
  const line = target.closest(".delta-line");
  const lineText = line ? getText(line) : getText(target);
  return [lineText, tooltipText].filter(Boolean).join(". ");
};

const updateDeltaTooltipPointerPosition = (target, clientX, clientY) => {
  if (!target || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  target.style.setProperty("--tooltip-x", `${x}px`);
  target.style.setProperty("--tooltip-y", `${y}px`);
};

const updateDeltaTooltip = (target, tooltipText) => {
  if (!target) {
    return;
  }
  if (!tooltipText) {
    target.classList.remove("has-tooltip", "is-tooltip-open");
    target.removeAttribute("data-tooltip");
    target.removeAttribute("tabindex");
    target.removeAttribute("role");
    target.removeAttribute("aria-label");
    target.removeAttribute("aria-expanded");
    return;
  }
  target.dataset.tooltip = tooltipText;
  target.classList.add("has-tooltip");
  target.setAttribute("tabindex", "0");
  target.setAttribute("role", "button");
  target.setAttribute("aria-label", buildDeltaTooltipAriaLabel(target, tooltipText));
  target.setAttribute(
    "aria-expanded",
    target.classList.contains("is-tooltip-open") ? "true" : "false"
  );
};

deltaTooltipTargets.forEach((target) => {
  target.addEventListener("pointerenter", (event) => {
    if (!target.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      updateDeltaTooltipPointerPosition(target, event.clientX, event.clientY);
    }
  });

  target.addEventListener("pointermove", (event) => {
    if (!target.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      updateDeltaTooltipPointerPosition(target, event.clientX, event.clientY);
    }
  });

  target.addEventListener("pointerdown", (event) => {
    if (!target.classList.contains("has-tooltip")) {
      return;
    }
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }
    updateDeltaTooltipPointerPosition(target, event.clientX, event.clientY);
    const isOpen = target.classList.toggle("is-tooltip-open");
    target.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) {
      closeDeltaTooltips(target);
    }
  });

  target.addEventListener("keydown", (event) => {
    if (!target.classList.contains("has-tooltip")) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const isOpen = target.classList.toggle("is-tooltip-open");
      target.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        closeDeltaTooltips(target);
      }
    } else if (event.key === "Escape") {
      target.classList.remove("is-tooltip-open");
      target.setAttribute("aria-expanded", "false");
    }
  });
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".delta-reference.has-tooltip")) {
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
    startOptimisticRotation([OPTIMISTIC_POLAR_COPY]);
    return;
  }
  const options = getOptimisticMessageOptions(data, month, hemisphere);
  if (!options.length) {
    startOptimisticRotation([OPTIMISTIC_FALLBACK_COPY]);
    return;
  }
  startOptimisticRotation(options);
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
  milestoneState.upcoming = milestones;
  if (resetIndex) {
    milestoneState.index = 0;
  } else if (milestoneState.index >= milestones.length) {
    milestoneState.index = 0;
  }
  milestoneState.timeZone = timeZone;
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
  const active = milestones[milestoneState.index];
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
        ? `Next milestone (${milestoneState.index + 1} of ${milestones.length})`
        : "Next milestone"
    );
  }
};

const celebrateMilestone = (milestone) => {
  if (!milestone) {
    milestoneState.lastCelebratedKey = null;
    return;
  }
  const key = getMilestoneKey(milestone);
  if (!key) {
    milestoneState.lastCelebratedKey = null;
    return;
  }
  if (key !== milestoneState.lastCelebratedKey) {
    milestoneState.lastCelebratedKey = key;
    launchConfetti();
  }
};

const updateDaylightForLocation = (location) => {
  if (!window.Astronomy || !location) {
    return;
  }
  const timeZone = location.timezone || FALLBACK_TIMEZONE;
  const hemisphere = location.latitude < 0 ? "south" : "north";
  const astronomy = createAstronomyContext(location, timeZone);
  const todayParts = getActiveDateParts(timeZone);
  syncDatePicker(timeZone);
  const weekParts = addDaysToDateParts(todayParts, -7);
  const monthParts = addMonthsToDateParts(todayParts, -1);

  const todayEvents = astronomy.getSunEvents(todayParts);
  const weekEvents = astronomy.getSunEvents(weekParts);
  const monthEvents = astronomy.getSunEvents(monthParts);

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
  const todayDaylight = astronomy.getDaylightMinutesForDateParts(todayParts);
  const weekDaylight = astronomy.getDaylightMinutesForDateParts(weekParts);
  const monthDaylight = astronomy.getDaylightMinutesForDateParts(monthParts);
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
  } = astronomy.getYearlySunExtremes(todayParts.year, todayDaylight);

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
  const comparisonReference =
    comparisonMode === "week" ? "1 week ago" : "1 month ago";
  const sunsetComparisonDelta =
    comparisonMode === "week" ? sunsetWeekDelta : sunsetMonthDelta;
  const daylightComparisonDelta =
    comparisonMode === "week" ? daylightWeekDelta : daylightMonthDelta;

  const sunsetEarliestText = formatDeltaStatement(
    sunsetEarliestDelta,
    "later",
    "earlier"
  );
  const daylightShortestText = formatDeltaStatement(
    daylightShortestDelta,
    "longer",
    "shorter"
  );
  const sunsetComparisonText = showComparison
    ? formatDeltaStatement(sunsetComparisonDelta, "later", "earlier")
    : "";
  const daylightComparisonText = showComparison
    ? formatDeltaStatement(daylightComparisonDelta, "longer", "shorter")
    : "";

  setText(sunsetEarliestDeltaValue, sunsetEarliestText);

  setText(
    daylightDurationValue,
    todayDaylight == null ? "—" : formatDuration(todayDaylight)
  );

  setText(daylightShortestDeltaValue, daylightShortestText);

  if (sunsetEarliestRow) {
    sunsetEarliestRow.classList.toggle("is-hidden", !sunsetEarliestText);
  }
  if (daylightShortestRow) {
    daylightShortestRow.classList.toggle("is-hidden", !daylightShortestText);
  }

  const showSunsetComparison = Boolean(sunsetComparisonText);
  const showDaylightComparison = Boolean(daylightComparisonText);

  if (sunsetComparisonRow) {
    sunsetComparisonRow.classList.toggle("is-hidden", !showSunsetComparison);
  }
  if (daylightComparisonRow) {
    daylightComparisonRow.classList.toggle("is-hidden", !showDaylightComparison);
  }

  setText(sunsetComparisonReference, showSunsetComparison ? comparisonReference : "");
  setText(daylightComparisonReference, showDaylightComparison ? comparisonReference : "");
  setText(sunsetComparisonDeltaValue, sunsetComparisonText);
  setText(daylightComparisonDeltaValue, daylightComparisonText);

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

  updateDeltaTooltip(
    sunsetEarliestReference,
    sunsetEarliestText ? sunsetEarliestTooltip : ""
  );
  updateDeltaTooltip(
    sunsetComparisonReference,
    showSunsetComparison ? sunsetComparisonTooltip : ""
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

  updateDeltaTooltip(
    daylightShortestReference,
    daylightShortestText ? daylightShortestTooltip : ""
  );
  const daylightComparisonTooltip =
    comparisonMode === "week" ? daylightWeekTooltip : daylightMonthTooltip;
  updateDeltaTooltip(
    daylightComparisonReference,
    showDaylightComparison ? daylightComparisonTooltip : ""
  );

  const startOfYearParts = { year: todayParts.year, month: 1, day: 1 };
  const sunsetStartOfYear =
    astronomy.getSunsetMinutesForDateParts(startOfYearParts);
  const twoMonthsParts = addMonthsToDateParts(todayParts, -2);
  const twoMonthsDaylight =
    astronomy.getDaylightMinutesForDateParts(twoMonthsParts);
  const endOfMonthParts = {
    year: todayParts.year,
    month: todayParts.month,
    day: getDaysInMonth(todayParts.year, todayParts.month),
  };
  const daylightAtEndOfMonth =
    astronomy.getDaylightMinutesForDateParts(endOfMonthParts);
  const in14Parts = addDaysToDateParts(todayParts, 14);
  const daylightIn14Days =
    astronomy.getDaylightMinutesForDateParts(in14Parts);
  const yesterdayParts = addDaysToDateParts(todayParts, -1);
  const yesterdayDaylight =
    astronomy.getDaylightMinutesForDateParts(yesterdayParts);
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
  const currentSeasonParts = astronomy.getSeasonDatePartsForYear(
    todayParts.year,
    hemisphere
  );
  const previousSummerSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
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
      ? astronomy.getWeeksWithSunsetAfter(todayParts, 19 * 60)
      : null;
  const averageWinterDaylight = astronomy.getAverageWinterDaylight(
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
    daylight_daily_gain_this_week_min:
      astronomy.getDaylightDailyGainThisWeekMin(todayParts),
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
      nextYearExtremes = astronomy.getYearlySunExtremes(
        todayParts.year + 1,
        null
      );
    }
    return nextYearExtremes[key] || null;
  };

  const previousWinterSolsticeParts = astronomy.getPreviousSeasonDateParts(
    todayParts,
    hemisphere,
    "winter"
  );
  const sunsetThresholdMatches = SUNSET_THRESHOLD_MILESTONES.map(
    (milestoneConfig) => ({
      ...milestoneConfig,
      match: astronomy.findFirstSunsetAfter(
        previousWinterSolsticeParts,
        milestoneConfig.minutes
      ),
    })
  );

  if (todaySunsetMinutes != null) {
    const targetMinutes = astronomy.getNextHalfHour(todaySunsetMinutes);
    if (targetMinutes > 0) {
      const targetLabel = formatTimeFromMinutes(
        targetMinutes,
        todayParts,
        timeZone
      );
      const milestoneMatch = astronomy.findNextSunsetThreshold(
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
      dateParts: astronomy.getNextSeasonDateParts(
        todayParts,
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
      dateParts: astronomy.findNextDaylightSavingsStart(todayParts),
      todayHeadline: "Daylight savings time starts today.",
      todayLede: "Don't forget to spring forward.",
    })
  );

  const firstTwelveHours = astronomy.findFirstDaylightAtLeast(
    previousWinterSolsticeParts,
    12 * 60
  );
  addMilestone(
    buildMilestone({
      id: "first-12-hours",
      title: "First day with at least 12 hours of daylight",
      dateParts: firstTwelveHours?.dateParts,
      todayHeadline: "Today has at least 12 hours of daylight.",
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
    .map((milestoneItem) => withMilestoneOffset(milestoneItem, todayParts))
    .filter(Boolean);
  const todayMilestone = milestoneOffsets.find(
    (milestoneItem) => milestoneItem.offsetDays === 0
  );
  if (todayMilestone) {
    stopOptimisticRotation();
    const todayCopy = getMilestoneTodayCopy(todayMilestone);
    if (todayCopy) {
      setOptimisticCopy(todayCopy, { animate: false });
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

  shareState.snapshot = {
    location,
    timeZone,
    dateParts: todayParts,
    todayDaylight,
    daylightGainToday,
    longestDayMinutes,
    shortestDayMinutes,
    sunsetEarliestDelta,
    hemisphere,
    fractionOfLossCompleted,
  };
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
  geolocateButton.disabled = searchState.locationBiasLoading;
  geolocateButton.title = searchState.locationBiasLoading ? "Locating..." : "Use my location";
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
    const { reverseGeocodeFailed, ...sanitized } = parsed;
    return sanitized;
  } catch (error) {
    console.warn("Unable to load stored location:", error);
    return null;
  }
};

const loadSharePrivacyPreference = () => {
  try {
    return localStorage.getItem(SHARE_PRIVACY_STORAGE_KEY) === "true";
  } catch (error) {
    console.warn("Unable to load share privacy preference:", error);
    return false;
  }
};

const saveSharePrivacyPreference = (value) => {
  try {
    localStorage.setItem(SHARE_PRIVACY_STORAGE_KEY, value ? "true" : "false");
  } catch (error) {
    console.warn("Unable to save share privacy preference:", error);
  }
};

const sanitizeStoredLocation = (location) => {
  if (!location || typeof location !== "object") {
    return location;
  }
  const { reverseGeocodeFailed, ...sanitized } = location;
  return sanitized;
};

const saveStoredLocation = (location) => {
  try {
    localStorage.setItem(
      ACTIVE_LOCATION_STORAGE_KEY,
      JSON.stringify(sanitizeStoredLocation(location))
    );
  } catch (error) {
    console.warn("Unable to save stored location:", error);
  }
};

const isCurrentLocation = (location) =>
  Boolean(location?.isCurrent) ||
  (location?.name || "").toLowerCase() ===
    CURRENT_LOCATION_LABEL.toLowerCase();

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
    ...searchState.recentLocations.filter(
      (entry) =>
        entry.name !== item.name ||
        entry.admin1 !== item.admin1 ||
        entry.country_code !== item.country_code
    ),
  ].slice(0, MAX_RECENTS);
  searchState.recentLocations = updated;
  saveRecentLocations(updated);
};

const showRecentResults = () => {
  if (!searchState.recentLocations.length) {
    clearResults();
    return;
  }
  const statusMessages = [
    { text: "Recent locations.", type: "hint" },
  ];
  const groups = [
    {
      label: "Recent",
      items: searchState.recentLocations,
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
    const index = searchState.suggestionResults.length;
    searchState.suggestionResults.push(item);
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
  searchState.suggestionResults = [];
  searchState.activeIndex = -1;
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
  searchState.suggestionResults = [];
  searchState.activeIndex = -1;
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

const buildCurrentLocation = (coords, { reverseGeocodeFailed = false } = {}) => ({
  name: CURRENT_LOCATION_LABEL,
  admin1: "",
  admin2: "",
  country: "",
  country_code: "",
  latitude: coords.lat,
  longitude: coords.lon,
  elevation: 0,
  timezone: FALLBACK_TIMEZONE,
  isCurrent: true,
  reverseGeocodeFailed,
});

const selectLocationFromCoords = async (coords) => {
  const currentLocation = buildCurrentLocation(coords);
  const resolved = await fetchReverseGeocodeLocation(currentLocation);
  if (resolved) {
    selectResult(resolved);
    return;
  }
  selectResult({ ...currentLocation, reverseGeocodeFailed: true });
};

const requestLocationBias = ({ onError } = {}) => {
  if (searchState.locationBiasRequested || !("geolocation" in navigator)) {
    return;
  }
  searchState.locationBiasRequested = true;
  searchState.locationBiasLoading = true;
  updateGeolocateButton();
  renderActions(getActionItems());
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      searchState.userCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      try {
        await selectLocationFromCoords(searchState.userCoords);
      } finally {
        searchState.locationBiasLoading = false;
        searchState.locationBiasRequested = false;
        updateGeolocateButton();
      }
    },
    (error) => {
      searchState.locationBiasLoading = false;
      searchState.locationBiasRequested = false;
      updateGeolocateButton();
      renderActions(getActionItems());
      if (typeof onError === "function") {
        onError(error);
      }
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
};

searchState.recentLocations = loadRecentLocations();

const clearResults = () => {
  searchState.suggestionResults = [];
  searchState.rawResults = [];
  searchState.activeIndex = -1;
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
  searchState.suggestionResults = [];
  searchState.activeIndex = -1;

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
  filterTokens = searchState.lastFilterTokens,
  rawTokens = searchState.lastFilterTokensRaw
) => {
  searchState.rawResults = results;
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
  const sortedLocal = sortByDistance(localResults, searchState.userCoords);
  const sortedAll = sortByDistance(effectiveResults, searchState.userCoords);
  const filterHint =
    rawTokens.length && !filteredResults.length
      ? `No matches for "${formatFilterTokensForHint(
          rawTokens
        )}". Showing broader results.`
      : null;
  const localityLabel = searchState.userCoords ? "nearby" : "local";
  let displayResults = sortedAll;
  let toggleLabel = null;
  const statusMessages = [];

  if (searchState.preferLocalResults && sortedLocal.length) {
    displayResults = sortedLocal;
    toggleLabel = otherResults.length ? "Show worldwide results" : null;
  } else if (searchState.preferLocalResults && !sortedLocal.length && regionCode) {
    displayResults = sortedAll;
    statusMessages.push({
      text: `No ${localityLabel} matches. Showing worldwide results.`,
      type: "hint",
    });
  } else {
    displayResults = sortedAll;
    if (sortedLocal.length && otherResults.length) {
      toggleLabel = searchState.userCoords ? "Prefer nearby results" : "Prefer local results";
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
    searchState.lastNameQuery
  );
  renderResults(groups, {
    statusMessages,
    actions: getActionItems({ toggleLabel }),
    emptyMessage: "No matches yet.",
  });
};

const selectResult = (item, { persist = true, updateRecents = true } = {}) => {
  clearReverseGeocodeCache();
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
  searchState.activeLocation = item;
  updateDaylightForLocation(item);
  if (isCurrentLocation(item) && !item.reverseGeocodeFailed) {
    void resolveCurrentLocationName(item);
  }
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
    searchState.activeIndex = -1;
    cityInput.removeAttribute("aria-activedescendant");
    return;
  }
  searchState.activeIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
  options.forEach((option, index) => {
    const isActive = index === searchState.activeIndex;
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

const mapReverseGeocodeResponse = (data, location) => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const name =
    [data.locality, data.city, data.principalSubdivision, data.countryName].find(
      (value) => typeof value === "string" && value.trim()
    ) || "";
  if (!name) {
    return null;
  }
  const latitude = Number.isFinite(data.latitude)
    ? data.latitude
    : location.latitude;
  const longitude = Number.isFinite(data.longitude)
    ? data.longitude
    : location.longitude;
  return {
    name,
    admin1: data.principalSubdivision || "",
    admin2: "",
    country: data.countryName || "",
    country_code: data.countryCode || "",
    latitude,
    longitude,
    elevation: 0,
    timezone: FALLBACK_TIMEZONE,
  };
};

const clearReverseGeocodeCache = () => {
  reverseGeocodeState.cache = null;
  reverseGeocodeState.cacheKey = "";
  reverseGeocodeState.promise = null;
};

const fetchReverseGeocodeLocation = async (location) => {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }
  const cacheKey = `${location.latitude},${location.longitude}`;
  if (reverseGeocodeState.cache && reverseGeocodeState.cacheKey === cacheKey) {
    return reverseGeocodeState.cache;
  }
  if (reverseGeocodeState.promise && reverseGeocodeState.cacheKey === cacheKey) {
    return reverseGeocodeState.promise;
  }
  reverseGeocodeState.cacheKey = cacheKey;
  reverseGeocodeState.promise = (async () => {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=${encodeURIComponent(
      languageCode
    )}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to reverse geocode location.");
      }
      const data = await response.json();
      return mapReverseGeocodeResponse(data, location);
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      return null;
    }
  })();
  const resolved = await reverseGeocodeState.promise;
  reverseGeocodeState.promise = null;
  reverseGeocodeState.cache = resolved;
  return resolved;
};

const resolveCurrentLocationName = async (location) => {
  if (!isCurrentLocation(location) || location?.reverseGeocodeFailed) {
    return;
  }
  const resolved = await fetchReverseGeocodeLocation(location);
  if (resolved) {
    selectResult(resolved, { persist: true, updateRecents: false });
  }
};

const fetchSuggestions = async (nameQuery, filterTokens, rawTokens) => {
  if (searchState.fetchController) {
    searchState.fetchController.abort();
  }
  searchState.fetchController = new AbortController();
  showLoadingState();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    nameQuery
  )}&count=20&language=${encodeURIComponent(
    languageCode
  )}&format=json`;
  try {
    const response = await fetch(url, { signal: searchState.fetchController.signal });
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
      searchState.userCoords = {
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
  const { nameQuery, filterTokens, rawFilterTokens } = parseQuery(query);
  searchState.lastNameQuery = nameQuery;
  searchState.lastFilterTokens = filterTokens;
  searchState.lastFilterTokensRaw = rawFilterTokens;
  updateClearButton();
  if (nameQuery.length < 2) {
    if (searchState.debounceId) {
      clearTimeout(searchState.debounceId);
      searchState.debounceId = null;
    }
    if (searchState.fetchController) {
      searchState.fetchController.abort();
      searchState.fetchController = null;
    }
    if (searchState.recentLocations.length) {
      showRecentResults();
    } else {
      clearResults();
    }
    return;
  }
  if (searchState.debounceId) {
    clearTimeout(searchState.debounceId);
  }
  searchState.debounceId = window.setTimeout(() => {
    fetchSuggestions(nameQuery, filterTokens, rawFilterTokens);
  }, 250);
};

const getSharePrivacySetting = () =>
  sharePrivacyToggle ? sharePrivacyToggle.checked : shareState.privacyEnabled;

const captureShareSnapshot = () => {
  const baseSnapshot = shareState.snapshot ? { ...shareState.snapshot } : {};
  shareState.modalSnapshot = {
    ...baseSnapshot,
    headline: getText(headline),
    lede: getText(lede),
  };
};

const resolveShareLocationLabel = async (location) => {
  if (getSharePrivacySetting()) {
    return "My Location";
  }
  if (!location) {
    return "Your location";
  }
  if (!isCurrentLocation(location)) {
    return formatSelectedLocation(location);
  }
  if (location.reverseGeocodeFailed) {
    return CURRENT_LOCATION_LABEL;
  }
  const resolved = await fetchReverseGeocodeLocation(location);
  return resolved ? formatSelectedLocation(resolved) : CURRENT_LOCATION_LABEL;
};

const buildShareMilestoneLine = () => {
  if (!milestoneState.upcoming.length) {
    return "📈 Upcoming milestone to be announced";
  }
  const active = milestoneState.upcoming[milestoneState.index] || milestoneState.upcoming[0];
  if (!active) {
    return "📈 Upcoming milestone to be announced";
  }
  const title = lowerCaseFirstLetter(active.title || "");
  const dayCount = formatShareDayCount(active.offsetDays);
  if (!dayCount) {
    return `📈 ${title || active.title}`;
  }
  return `📈 ${dayCount} until ${title || active.title}`;
};

const buildShareMessage = async () => {
  const snapshot = shareState.modalSnapshot || shareState.snapshot;
  const timeZone = snapshot?.timeZone || FALLBACK_TIMEZONE;
  const dateParts = snapshot?.dateParts || getActiveDateParts(timeZone);
  const dateLabel = formatShareDateFromParts(dateParts) || "—";
  const headlineText =
    snapshot?.headline || getText(headline) || "Sunshine Optimist";
  const locationLabel = await resolveShareLocationLabel(
    snapshot?.location || searchState.activeLocation
  );
  const progressLine = buildShareProgressLine(snapshot);
  const daylightText = Number.isFinite(snapshot?.todayDaylight)
    ? formatDuration(snapshot.todayDaylight)
    : "—";
  const sunsetDeltaText = formatShareMinutes(snapshot?.sunsetEarliestDelta);
  const milestoneLine = buildShareMilestoneLine();
  const lines = [`☀️ ${locationLabel} — ${dateLabel}`, "", headlineText, ""];
  if (progressLine) {
    lines.push(progressLine, "");
  }
  lines.push(`☀️ ${daylightText} of daylight today`);
  lines.push(`🌅 Sunset ${sunsetDeltaText} later than the earliest sunset`);
  if (milestoneLine) {
    lines.push(milestoneLine);
  }
  lines.push("", "SunshineOptimist.com");
  return lines.join("\n");
};

const setSharePreviewText = (text) => {
  shareState.text = text || "";
  setText(sharePreview, shareState.text);
};

const refreshSharePreview = async () => {
  if (!sharePreview) {
    return;
  }
  shareState.text = "";
  setText(sharePreview, "Preparing your share...");
  try {
    const message = await buildShareMessage();
    setSharePreviewText(message);
  } catch (error) {
    console.warn("Share preview failed:", error);
    setText(sharePreview, "Unable to prepare share text.");
  }
};

const openShareModal = () => {
  if (!shareModal) {
    return;
  }
  captureShareSnapshot();
  if (typeof shareModal.showModal === "function") {
    if (!shareModal.open) {
      shareModal.showModal();
    }
  } else {
    shareModal.setAttribute("open", "true");
  }
  refreshSharePreview();
};

const closeShareModal = () => {
  if (!shareModal) {
    return;
  }
  shareState.modalSnapshot = null;
  if (typeof shareModal.close === "function") {
    shareModal.close();
  } else {
    shareModal.removeAttribute("open");
  }
};

const ensureShareText = async () => {
  if (shareState.text) {
    return shareState.text;
  }
  const message = await buildShareMessage();
  setSharePreviewText(message);
  return message;
};

const copyShareText = async () => {
  const text = await ensureShareText();
  if (!navigator.clipboard?.writeText) {
    return false;
  }
  await navigator.clipboard.writeText(text);
  return true;
};

const openShareLink = (url) => {
  if (!url) {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
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
    if (!searchState.suggestionResults.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(searchState.activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(searchState.activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateActiveOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateActiveOption(searchState.suggestionResults.length - 1);
    } else if (event.key === "Enter") {
      if (searchState.activeIndex >= 0) {
        event.preventDefault();
        selectResult(searchState.suggestionResults[searchState.activeIndex]);
      } else if (searchState.suggestionResults.length) {
        event.preventDefault();
        selectResult(searchState.suggestionResults[0]);
      }
    }
  });
}

if (clearButton && cityInput) {
  clearButton.addEventListener("click", () => {
    setInputValue(cityInput, "");
    searchState.lastNameQuery = "";
    searchState.lastFilterTokens = [];
    searchState.lastFilterTokensRaw = [];
    updateClearButton();
    if (searchState.recentLocations.length) {
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
    dateState.lastKeydownAt = Date.now();
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("pointerdown", () => {
    dateState.lastKeydownAt = 0;
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
    dateState.lastKeydownAt = 0;
    const didChange = applyDateSelection(null);
    const timeZone = searchState.activeLocation?.timezone || FALLBACK_TIMEZONE;
    syncDatePicker(timeZone);
    if (searchState.activeLocation && didChange) {
      updateDaylightForLocation(searchState.activeLocation);
    }
  });
}

if (milestoneToggle) {
  milestoneToggle.addEventListener("click", () => {
    if (!milestoneState.upcoming.length) {
      return;
    }
    milestoneState.index = (milestoneState.index + 1) % milestoneState.upcoming.length;
    updateMilestoneCard(
      milestoneState.upcoming,
      milestoneState.timeZone || FALLBACK_TIMEZONE,
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
    const item = searchState.suggestionResults[index];
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
      const item = searchState.suggestionResults[index];
      if (item) {
        selectResult(item);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(searchState.activeIndex + 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[searchState.activeIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(searchState.activeIndex - 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[searchState.activeIndex]?.focus();
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
      searchState.preferLocalResults = !searchState.preferLocalResults;
      if (searchState.rawResults.length) {
        buildResults(searchState.rawResults, searchState.lastFilterTokens, searchState.lastFilterTokensRaw);
      }
    } else if (actionType === "retry") {
      if (searchState.lastNameQuery.length >= 2) {
        fetchSuggestions(searchState.lastNameQuery, searchState.lastFilterTokens, searchState.lastFilterTokensRaw);
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
shareState.privacyEnabled = loadSharePrivacyPreference();

if (sharePrivacyToggle) {
  sharePrivacyToggle.checked = shareState.privacyEnabled;
  sharePrivacyToggle.addEventListener("change", () => {
    shareState.privacyEnabled = sharePrivacyToggle.checked;
    saveSharePrivacyPreference(shareState.privacyEnabled);
    if (shareModal?.open || shareModal?.hasAttribute("open")) {
      refreshSharePreview();
    }
  });
}

if (shareModalClose) {
  shareModalClose.addEventListener("click", () => {
    closeShareModal();
  });
}

if (shareModal) {
  shareModal.addEventListener("click", (event) => {
    if (event.target === shareModal) {
      closeShareModal();
    }
  });
  shareModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeShareModal();
  });
}

const flashActionLabel = (button, message) => {
  if (!button) {
    return;
  }
  if (button.classList.contains("share-copy-button")) {
    const previousText = button.textContent;
    setText(button, message);
    button.classList.add("is-flash");
    setTimeout(() => {
      setText(button, previousText);
      button.classList.remove("is-flash");
    }, 1200);
    return;
  }
  const previousLabel = button.getAttribute("aria-label") || "";
  const previousTitle = button.getAttribute("title") || "";
  button.setAttribute("aria-label", message);
  button.setAttribute("title", message);
  button.classList.add("is-flash");
  setTimeout(() => {
    button.setAttribute("aria-label", previousLabel);
    button.setAttribute("title", previousTitle);
    button.classList.remove("is-flash");
  }, 1200);
};

if (shareActionButtons.length) {
  shareActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.share;
      if (!action) {
        return;
      }
      try {
        if (action === "copy") {
          const success = await copyShareText();
          if (success) {
            flashActionLabel(button, "Copied!");
          }
          return;
        }
        if (action === "instagram") {
          const success = await copyShareText();
          if (success) {
            flashActionLabel(button, "Copied!");
          }
          openShareLink("https://www.instagram.com/");
          return;
        }
        const text = await ensureShareText();
        const encodedText = encodeURIComponent(text);
        if (action === "facebook") {
          const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            "https://sunshineoptimist.com"
          )}&quote=${encodedText}`;
          openShareLink(url);
          return;
        }
        if (action === "x") {
          const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
          openShareLink(url);
          return;
        }
        if (action === "bluesky") {
          const url = `https://bsky.app/intent/compose?text=${encodedText}`;
          openShareLink(url);
        }
      } catch (error) {
        console.warn("Share action failed:", error);
      }
    });
  });
}

if (shareButton) {
  shareButton.addEventListener("click", () => {
    openShareModal();
  });
}
