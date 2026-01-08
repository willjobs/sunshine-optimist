/**
 * Sunshine Optimist - Main Application Entry Point
 *
 * This module initializes the application, wires up event handlers,
 * and coordinates between UI modules, services, and state management.
 */

import { createDateFormatter } from "./utils/date-utils.js";
import { setInputValue } from "./utils/dom-utils.js";
import {
  getSuggestionResults,
  getActiveIndex,
  getUpcomingMilestones,
  getMilestoneIndex,
  setMilestoneIndex,
  getMilestoneTimeZone,
  getOptimisticDebugState,
  setLastKeydownAt,
  setLastNameQuery,
  setLastFilterTokens,
  setLastFilterTokensRaw,
  isSharePrivacyEnabled,
  setSharePrivacyEnabled,
} from "./state/app-state.js";
import {
  loadSharePrivacyPreference,
  saveSharePrivacyPreference,
} from "./services/storage-service.js";
import { initializeTooltipTarget, initializeGlobalTooltipHandlers } from "./ui/tooltip-ui.js";
import { updateMilestoneCard } from "./ui/milestone-ui.js";
import {
  openShareModal,
  closeShareModal,
  refreshSharePreview,
  copyShareText,
  shareTextWithWebShare,
  shareStoryWithWebShare,
  flashActionLabel,
  getShareMode,
  setShareMode,
  refreshStoryPreview,
  getLastGeneratedCanvas,
  canUseWebShare,
  canShareStoryImage,
} from "./ui/share-modal-ui.js";
import { downloadStoryImage } from "./ui/story-image-ui.js";

// Controllers
import {
  getActiveDateParts,
  syncDatePicker,
  clearDateCommitTimeout,
  commitDateSelection,
  scheduleDateCommit,
  isRecentDateKeyboardInput,
  resetToLiveDate,
  setDateChangeCallback,
} from "./controllers/date-controller.js";
import { updateOptimisticMessage } from "./controllers/optimistic-controller.js";
import {
  initLocationController,
  setLocationChangeCallback,
  initializeLocation,
  handleInput,
  updateClearButton,
  updateGeolocateButton,
  clearResults,
  showRecentResults,
  selectResult,
  updateActiveOption,
  requestLocationBias,
  updateResultsMaxHeight,
  handleTogglePreference,
  handleRetry,
} from "./controllers/location-controller.js";
import { updateDaylightForLocation } from "./controllers/daylight-controller.js";

// ============================================================================
// Constants
// ============================================================================
const FALLBACK_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// Locale detection
const localeSource = navigator.languages?.[0] || navigator.language || "en";
const languageCode = localeSource.split("-")[0] || "en";
const regionCode = (localeSource.split("-")[1] || "").toUpperCase();

// Date formatters
const { formatLongDateFromParts, formatShortDateFromParts, formatTime, formatTimeFromMinutes } =
  createDateFormatter(localeSource);

// ============================================================================
// DOM Elements
// ============================================================================
const dom = {
  shareButton: document.getElementById("share"),
  shareModal: document.getElementById("share-modal"),
  shareModalClose: document.getElementById("share-modal-close"),
  sharePreview: document.getElementById("share-preview"),
  sharePrivacyToggle: document.getElementById("share-privacy-toggle"),
  shareActionButtons: document.querySelectorAll(".share-icon-button[data-share]"),
  shareWebWrappers: document.querySelectorAll(".share-web-wrapper[data-share-mode]"),
  shareModeButtons: document.querySelectorAll(".share-mode-button[data-share-mode]"),
  shareTextPreview: document.getElementById("share-text-preview"),
  shareStoryPreview: document.getElementById("share-story-preview"),
  shareStoryImage: document.getElementById("share-story-image"),
  shareDownloadWrapper: document.querySelector(".share-download-wrapper"),
  shareDownloadButton: document.getElementById("share-download-button"),
  shareDownloadFeedback: document.getElementById("share-download-feedback"),
  shareCopyButton: document.querySelector(".share-copy-button"),
  shareCopyFeedback: document.getElementById("share-copy-feedback"),
  optimisticMessage: document.getElementById("optimistic-message"),
  optimisticDots: document.getElementById("optimistic-dots"),
  optimisticPrev: document.getElementById("optimistic-prev"),
  optimisticNext: document.getElementById("optimistic-next"),
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
  sunsetComparisonReference: document.getElementById("sunset-comparison-reference"),
  daylightShortestReference: document.getElementById("daylight-shortest-reference"),
  daylightComparisonReference: document.getElementById("daylight-comparison-reference"),
  nextHeadline: document.getElementById("next-headline"),
  nextDate: document.getElementById("next-date"),
  nextAway: document.getElementById("next-away"),
  dateInput: document.getElementById("date-input"),
  dateReset: document.getElementById("date-reset"),
  datePicker: document.querySelector(".date-picker"),
};

// Destructure for convenience
const {
  shareButton,
  shareModal,
  shareModalClose,
  sharePreview,
  sharePrivacyToggle,
  shareActionButtons,
  shareWebWrappers,
  shareModeButtons,
  shareTextPreview,
  shareStoryPreview,
  shareStoryImage,
  shareDownloadWrapper,
  shareDownloadButton,
  shareDownloadFeedback,
  shareCopyButton,
  shareCopyFeedback,
  headline,
  lede,
  cityInput,
  geolocateButton,
  resultsActions,
  resultsList,
  clearButton,
  milestone,
  milestoneToggle,
  dateInput,
  dateReset,
  datePicker,
} = dom;

// ============================================================================
// Controller Initialization
// ============================================================================

// Initialize location controller with DOM elements
initLocationController(dom, {
  languageCode,
  regionCode,
  fallbackTimeZone: FALLBACK_TIMEZONE,
});

// Create formatters object for daylight controller
const formatters = {
  formatLongDateFromParts,
  formatShortDateFromParts,
  formatTime,
  formatTimeFromMinutes,
};

// Wrapper function for updating daylight that provides all dependencies
const handleDaylightUpdate = (location) => {
  updateDaylightForLocation({
    location,
    dom,
    getActiveDateParts: (tz) => getActiveDateParts(tz),
    syncDatePicker: (tz) => syncDatePicker(dateInput, dateReset, datePicker, tz),
    updateOptimisticMessage,
    formatters,
    fallbackTimeZone: FALLBACK_TIMEZONE,
  });
};

// Wire up callbacks between controllers
setLocationChangeCallback(handleDaylightUpdate);
setDateChangeCallback(handleDaylightUpdate);

// ============================================================================
// Event Handlers Setup
// ============================================================================

// City input handlers
if (cityInput) {
  cityInput.addEventListener("input", handleInput);
  cityInput.addEventListener("focus", handleInput);
  cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearResults();
      return;
    }
    if (!getSuggestionResults().length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateActiveOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateActiveOption(getSuggestionResults().length - 1);
    } else if (event.key === "Enter") {
      const activeIndex = getActiveIndex();
      const suggestionResults = getSuggestionResults();
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

// Clear button handler
if (clearButton && cityInput) {
  clearButton.addEventListener("click", () => {
    setInputValue(cityInput, "");
    setLastNameQuery("");
    setLastFilterTokens([]);
    setLastFilterTokensRaw([]);
    updateClearButton();
    showRecentResults();
    cityInput.focus();
  });
}

// Geolocation button handler
if (geolocateButton && cityInput) {
  geolocateButton.addEventListener("click", () => {
    requestLocationBias();
    cityInput.focus();
  });
}

// Date input handlers
if (dateInput) {
  const handleDateCommitInput = () => {
    if (isRecentDateKeyboardInput()) return;
    scheduleDateCommit(dateInput, dateReset, datePicker, FALLBACK_TIMEZONE);
  };

  dateInput.addEventListener("input", handleDateCommitInput);
  dateInput.addEventListener("change", handleDateCommitInput);
  dateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitDateSelection(dateInput, dateReset, datePicker, FALLBACK_TIMEZONE);
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
    setLastKeydownAt(Date.now());
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("pointerdown", () => {
    setLastKeydownAt(0);
    clearDateCommitTimeout();
  });
  dateInput.addEventListener("blur", () => {
    clearDateCommitTimeout();
    commitDateSelection(dateInput, dateReset, datePicker, FALLBACK_TIMEZONE);
  });
}

// Date reset button handler
if (dateReset) {
  dateReset.addEventListener("click", () => {
    resetToLiveDate(dateInput, dateReset, datePicker, FALLBACK_TIMEZONE);
  });
}

// Milestone toggle handler
if (milestoneToggle) {
  milestoneToggle.addEventListener("click", () => {
    const upcoming = getUpcomingMilestones();
    if (!upcoming.length) return;
    const currentIndex = getMilestoneIndex();
    const nextIndex = (currentIndex + 1) % upcoming.length;
    setMilestoneIndex(nextIndex);
    updateMilestoneCard(
      {
        nextHeadline: dom.nextHeadline,
        nextDate: dom.nextDate,
        nextAway: dom.nextAway,
        milestone,
        milestoneToggle,
      },
      upcoming,
      getMilestoneTimeZone() || FALLBACK_TIMEZONE,
      formatLongDateFromParts,
      { resetIndex: false }
    );
  });
}

// Results list handlers
if (resultsList) {
  resultsList.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".location-option");
    if (!target) return;
    const index = Number(target.dataset.index);
    const item = getSuggestionResults()[index];
    if (item) selectResult(item);
  });

  resultsList.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".location-option");
    if (!target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = Number(target.dataset.index);
      const item = getSuggestionResults()[index];
      if (item) selectResult(item);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() + 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[getActiveIndex()]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(getActiveIndex() - 1);
      const options = resultsList.querySelectorAll(".location-option");
      options[getActiveIndex()]?.focus();
    } else if (event.key === "Escape") {
      clearResults();
      cityInput?.focus();
    }
  });
}

// Results actions handlers
if (resultsActions) {
  resultsActions.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest("[data-action]");
    if (!action) return;
    event.stopPropagation();
    const actionType = action.dataset.action;
    if (actionType === "toggle-preference") {
      handleTogglePreference();
    } else if (actionType === "retry") {
      handleRetry();
    }
  });
}

// Close results when clicking/focusing outside
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

// Initialize tooltips
const deltaTooltipTargets = [
  dom.sunsetEarliestReference,
  dom.sunsetComparisonReference,
  dom.daylightShortestReference,
  dom.daylightComparisonReference,
].filter(Boolean);

deltaTooltipTargets.forEach((target) => {
  initializeTooltipTarget(target, deltaTooltipTargets);
});

initializeGlobalTooltipHandlers(deltaTooltipTargets);

// ============================================================================
// Share Modal Setup
// ============================================================================

// Initialize share privacy preference
setSharePrivacyEnabled(loadSharePrivacyPreference());

if (sharePrivacyToggle) {
  sharePrivacyToggle.checked = isSharePrivacyEnabled();
  sharePrivacyToggle.addEventListener("change", async () => {
    setSharePrivacyEnabled(sharePrivacyToggle.checked);
    saveSharePrivacyPreference(sharePrivacyToggle.checked);
    if (shareModal?.open || shareModal?.hasAttribute("open")) {
      if (getShareMode() === "story" && shareStoryImage) {
        await refreshStoryPreview(shareStoryImage, headline, lede, languageCode, FALLBACK_TIMEZONE);
      } else {
        refreshSharePreview(
          sharePreview,
          headline,
          lede,
          (tz) => getActiveDateParts(tz),
          languageCode,
          FALLBACK_TIMEZONE
        );
      }
    }
  });
}

const updateShareWebButtonsVisibility = () => {
  if (!shareWebWrappers.length) {
    return;
  }
  const activeMode = getShareMode();
  const canShare = canUseWebShare();
  shareWebWrappers.forEach((wrapper) => {
    const mode = wrapper.dataset.shareMode;
    let shouldShow = canShare && mode === activeMode;
    if (shouldShow && mode === "story") {
      shouldShow = canShareStoryImage();
    }
    wrapper.hidden = !shouldShow;
  });
};

updateShareWebButtonsVisibility();
window.addEventListener("resize", updateShareWebButtonsVisibility);

// Reset share modal UI to default text mode
const resetShareModalUI = () => {
  shareModeButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.shareMode === "text");
  });
  if (shareTextPreview) shareTextPreview.hidden = false;
  if (shareStoryPreview) shareStoryPreview.hidden = true;
  if (shareCopyButton) shareCopyButton.hidden = false;
  if (shareDownloadWrapper) shareDownloadWrapper.hidden = true;
  if (shareCopyFeedback) {
    shareCopyFeedback.hidden = true;
    shareCopyFeedback.classList.remove("is-visible");
  }
  if (shareDownloadFeedback) {
    shareDownloadFeedback.hidden = true;
    shareDownloadFeedback.classList.remove("is-visible");
  }
  updateShareWebButtonsVisibility();
};

if (shareModalClose) {
  shareModalClose.addEventListener("click", () => {
    closeShareModal(shareModal);
    resetShareModalUI();
  });
}

if (shareModal) {
  shareModal.addEventListener("click", (event) => {
    if (event.target === shareModal) {
      closeShareModal(shareModal);
      resetShareModalUI();
    }
  });
  shareModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeShareModal(shareModal);
    resetShareModalUI();
  });
}

if (shareActionButtons.length) {
  shareActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.share;
      if (!action) return;
      try {
        if (action === "copy") {
          const success = await copyShareText(
            headline,
            lede,
            (tz) => getActiveDateParts(tz),
            languageCode,
            FALLBACK_TIMEZONE
          );
          if (success) {
            flashActionLabel(button, "Copied to clipboard!", shareCopyFeedback);
          }
          return;
        }
        if (action === "web-text") {
          await shareTextWithWebShare(
            headline,
            lede,
            (tz) => getActiveDateParts(tz),
            languageCode,
            FALLBACK_TIMEZONE
          );
          return;
        }
        if (action === "web-story") {
          if (!getLastGeneratedCanvas() && shareStoryImage) {
            await refreshStoryPreview(
              shareStoryImage,
              headline,
              lede,
              languageCode,
              FALLBACK_TIMEZONE
            );
          }
          await shareStoryWithWebShare();
        }
      } catch (error) {
        console.warn("Share action failed:", error);
      }
    });
  });
}

if (shareButton) {
  shareButton.addEventListener("click", () => {
    openShareModal(
      shareModal,
      sharePreview,
      headline,
      lede,
      (tz) => getActiveDateParts(tz),
      languageCode,
      FALLBACK_TIMEZONE
    );
  });
}

// Share mode toggle handlers
if (shareModeButtons.length) {
  shareModeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = button.dataset.shareMode;
      if (!mode || getShareMode() === mode) return;

      setShareMode(mode);

      // Update button active states
      shareModeButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.shareMode === mode);
      });

      // Toggle visibility based on mode
      const isStoryMode = mode === "story";

      // Toggle preview areas
      if (shareTextPreview) {
        shareTextPreview.hidden = isStoryMode;
      }
      if (shareStoryPreview) {
        shareStoryPreview.hidden = !isStoryMode;
      }

      // Toggle action buttons
      if (shareCopyButton) {
        shareCopyButton.hidden = isStoryMode;
      }
      if (shareDownloadWrapper) {
        shareDownloadWrapper.hidden = !isStoryMode;
      }
      if (shareCopyFeedback && isStoryMode) {
        shareCopyFeedback.hidden = true;
        shareCopyFeedback.classList.remove("is-visible");
      }
      if (shareDownloadFeedback && !isStoryMode) {
        shareDownloadFeedback.hidden = true;
        shareDownloadFeedback.classList.remove("is-visible");
      }
      updateShareWebButtonsVisibility();

      // Refresh the appropriate preview when switching modes
      if (isStoryMode && shareStoryImage) {
        await refreshStoryPreview(shareStoryImage, headline, lede, languageCode, FALLBACK_TIMEZONE);
      } else {
        refreshSharePreview(
          sharePreview,
          headline,
          lede,
          (tz) => getActiveDateParts(tz),
          languageCode,
          FALLBACK_TIMEZONE
        );
      }
    });
  });
}

// Download button handler
if (shareDownloadButton) {
  shareDownloadButton.addEventListener("click", async () => {
    const canvas = getLastGeneratedCanvas();
    if (!canvas) return;
    try {
      await downloadStoryImage(canvas);
      flashActionLabel(shareDownloadButton, "Image downloaded!", shareDownloadFeedback);
    } catch (error) {
      console.warn("Story download failed:", error);
    }
  });
}

// ============================================================================
// Debug API
// ============================================================================

const getOptimisticDebugSnapshot = () => {
  const debugState = getOptimisticDebugState();
  return {
    validOptions: debugState.validOptions,
    displayedOptions: debugState.displayedOptions,
    data: debugState.data,
    month: debugState.month,
    hemisphere: debugState.hemisphere,
    reason: debugState.reason,
    lastUpdatedAt: debugState.lastUpdatedAt,
  };
};

window.SunshineOptimistDebug = {
  getOptimisticMessages: getOptimisticDebugSnapshot,
  printOptimisticMessages: () => {
    const snapshot = getOptimisticDebugSnapshot();
    const list = snapshot.validOptions.length ? snapshot.validOptions : snapshot.displayedOptions;
    if (typeof console.table === "function") {
      console.table(
        list.map((item, index) => ({
          index,
          headline: item?.headline || "",
          lede: item?.lede || "",
        }))
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(list);
    }
    return snapshot;
  },
};

// ============================================================================
// Initialize Application
// ============================================================================

syncDatePicker(dateInput, dateReset, datePicker, FALLBACK_TIMEZONE);
updateGeolocateButton();
initializeLocation();
