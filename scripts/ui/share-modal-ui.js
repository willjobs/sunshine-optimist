/**
 * Share modal functionality
 */

import { setText, getText } from "../utils/dom-utils.js";
import {
  getShareSnapshot,
  setShareSnapshot,
  getModalSnapshot,
  setModalSnapshot,
  isSharePrivacyEnabled,
  getShareText,
  setShareText,
  getActiveLocation,
  getUpcomingMilestones,
  getMilestoneIndex,
} from "../state/app-state.js";
import {
  formatDuration,
  formatShareDateFromParts,
  formatShareMinutes,
  formatShareDayCount,
  buildShareBar,
  formatSharePercent,
  lowerCaseFirstLetter,
} from "../formatters/formatters.js";
import { formatSelectedLocation } from "../utils/location-utils.js";
import { getAdjustedMonth } from "../utils/date-utils.js";
import { fetchReverseGeocodeLocation } from "../services/reverse-geocode-service.js";
import { clampValue } from "../utils/utils.js";
import { generateStoryCanvas } from "./story-image-ui.js";

const CURRENT_LOCATION_LABEL = "Current Location";

/**
 * Store the last generated canvas for download functionality
 */
let lastGeneratedCanvas = null;

/**
 * Get the last generated canvas for download
 */
export const getLastGeneratedCanvas = () => lastGeneratedCanvas;

/**
 * Share mode state - "text" or "story"
 */
let shareMode = "text";

/**
 * Get current share mode
 */
export const getShareMode = () => shareMode;

/**
 * Set share mode
 */
export const setShareMode = (mode) => {
  shareMode = mode === "story" ? "story" : "text";
};

/**
 * Check if a location is "Current Location"
 */
const isCurrentLocation = (location) =>
  Boolean(location?.isCurrent) ||
  (location?.name || "").toLowerCase() === CURRENT_LOCATION_LABEL.toLowerCase();

/**
 * Get share progress mode based on month and hemisphere
 */
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

/**
 * Calculate loss fraction for progress bar
 */
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
  return clampValue((snapshot.longestDayMinutes - snapshot.todayDaylight) / totalLoss, 0, 1);
};

/**
 * Build share progress line
 */
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
      snapshot.fractionOfLossCompleted !== null
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

/**
 * Resolve location label for sharing
 */
const resolveShareLocationLabel = async (location, languageCode) => {
  if (isSharePrivacyEnabled()) {
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
  const resolved = await fetchReverseGeocodeLocation(location, languageCode);
  return resolved ? formatSelectedLocation(resolved) : CURRENT_LOCATION_LABEL;
};

/**
 * Build milestone line for share text
 */
const buildShareMilestoneLine = () => {
  const upcoming = getUpcomingMilestones();
  if (!upcoming.length) {
    return "📈 Upcoming milestone to be announced";
  }
  const index = getMilestoneIndex();
  const active = upcoming[index] || upcoming[0];
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

/**
 * Build share message text
 */
export const buildShareMessage = async (
  headline,
  lede,
  getActiveDateParts,
  languageCode,
  fallbackTimeZone
) => {
  const snapshot = getModalSnapshot() || getShareSnapshot();
  const timeZone = snapshot?.timeZone || fallbackTimeZone;
  const dateParts = snapshot?.dateParts || getActiveDateParts(timeZone);
  const dateLabel = formatShareDateFromParts(dateParts) || "—";
  const headlineText = snapshot?.headline || getText(headline) || "Sunshine Optimist";
  const locationLabel = await resolveShareLocationLabel(
    snapshot?.location || getActiveLocation(),
    languageCode
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

/**
 * Capture share snapshot from current state
 */
export const captureShareSnapshot = (headline, lede) => {
  const baseSnapshot = getShareSnapshot() ? { ...getShareSnapshot() } : {};
  setModalSnapshot({
    ...baseSnapshot,
    headline: getText(headline),
    lede: getText(lede),
  });
};

/**
 * Update share snapshot with daylight data
 */
export const updateShareSnapshot = (data) => {
  setShareSnapshot(data);
};

/**
 * Set share preview text
 */
export const setSharePreviewText = (sharePreview, text) => {
  setShareText(text || "");
  setText(sharePreview, getShareText());
};

/**
 * Refresh share preview
 */
export const refreshSharePreview = async (
  sharePreview,
  headline,
  lede,
  getActiveDateParts,
  languageCode,
  fallbackTimeZone
) => {
  if (!sharePreview) {
    return;
  }
  setShareText("");
  setText(sharePreview, "Preparing your share...");
  try {
    const message = await buildShareMessage(
      headline,
      lede,
      getActiveDateParts,
      languageCode,
      fallbackTimeZone
    );
    setSharePreviewText(sharePreview, message);
  } catch (error) {
    console.warn("Share preview failed:", error);
    setText(sharePreview, "Unable to prepare share text.");
  }
};

/**
 * Open share modal
 */
export const openShareModal = (
  shareModal,
  sharePreview,
  headline,
  lede,
  getActiveDateParts,
  languageCode,
  fallbackTimeZone
) => {
  if (!shareModal) {
    return;
  }
  captureShareSnapshot(headline, lede);
  if (typeof shareModal.showModal === "function") {
    if (!shareModal.open) {
      shareModal.showModal();
    }
  } else {
    shareModal.setAttribute("open", "true");
  }
  refreshSharePreview(
    sharePreview,
    headline,
    lede,
    getActiveDateParts,
    languageCode,
    fallbackTimeZone
  );
};

/**
 * Close share modal
 */
export const closeShareModal = (shareModal) => {
  if (!shareModal) {
    return;
  }
  setModalSnapshot(null);
  shareMode = "text";
  if (typeof shareModal.close === "function") {
    shareModal.close();
  } else {
    shareModal.removeAttribute("open");
  }
};

/**
 * Ensure share text is available
 */
export const ensureShareText = async (
  headline,
  lede,
  getActiveDateParts,
  languageCode,
  fallbackTimeZone
) => {
  const currentText = getShareText();
  if (currentText) {
    return currentText;
  }
  const message = await buildShareMessage(
    headline,
    lede,
    getActiveDateParts,
    languageCode,
    fallbackTimeZone
  );
  setShareText(message);
  return message;
};

/**
 * Copy share text to clipboard
 */
export const copyShareText = async (
  headline,
  lede,
  getActiveDateParts,
  languageCode,
  fallbackTimeZone
) => {
  const text = await ensureShareText(
    headline,
    lede,
    getActiveDateParts,
    languageCode,
    fallbackTimeZone
  );
  if (!navigator.clipboard?.writeText) {
    return false;
  }
  await navigator.clipboard.writeText(text);
  return true;
};

/**
 * Open share link in new window
 */
export const openShareLink = (url) => {
  if (!url) {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

/**
 * Flash action button label temporarily
 */
export const flashActionLabel = (button, message, feedbackElement) => {
  if (!button) {
    return;
  }
  const hasFeedbackElement =
    feedbackElement &&
    (button.classList.contains("share-copy-button") ||
      button.classList.contains("share-download-button"));
  if (hasFeedbackElement) {
    if (message) {
      setText(feedbackElement, message);
    }
    feedbackElement.hidden = false;
    feedbackElement.classList.add("is-visible");
    button.classList.add("is-flash");
    setTimeout(() => {
      feedbackElement.classList.remove("is-visible");
      button.classList.remove("is-flash");
      setTimeout(() => {
        feedbackElement.hidden = true;
      }, 200);
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

/**
 * Refresh story preview image
 */
export const refreshStoryPreview = async (imgElement, headline, _lede, languageCode) => {
  if (!imgElement) {
    return;
  }
  const snapshot = getModalSnapshot() || getShareSnapshot();
  const locationLabel = await resolveShareLocationLabel(
    snapshot?.location || getActiveLocation(),
    languageCode
  );
  const headlineText = snapshot?.headline || getText(headline) || "Sunshine Optimist";

  const generatedCanvas = await generateStoryCanvas(headlineText, locationLabel);

  // Store the canvas for download functionality
  lastGeneratedCanvas = generatedCanvas;

  // Convert canvas to data URL and set as img src for native long-press save
  imgElement.src = generatedCanvas.toDataURL("image/png");
};
