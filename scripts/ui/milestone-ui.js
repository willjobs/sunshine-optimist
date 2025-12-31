/**
 * Milestone card rendering and interaction
 */

import { setText } from "../utils/dom-utils.js";
import { formatMilestoneAway } from "../formatters/formatters.js";
import {
  getUpcomingMilestones,
  setUpcomingMilestones,
  getMilestoneIndex,
  setMilestoneIndex,
  setMilestoneTimeZone,
  getLastCelebratedKey,
  setLastCelebratedKey,
} from "../state/app-state.js";
import { formatDateInputValue } from "../utils/date-utils.js";
import { launchConfetti } from "./confetti-ui.js";

/**
 * Get milestone cache key for celebration tracking
 */
export const getMilestoneKey = (milestone) => {
  if (!milestone) {
    return "";
  }
  const dateStamp = formatDateInputValue(milestone.dateParts);
  return `${milestone.id || milestone.title}:${dateStamp}`;
};

/**
 * Get milestone day copy (headline and lede)
 */
export const getMilestoneTodayCopy = (milestone) => {
  if (!milestone) {
    return null;
  }
  return {
    headline: milestone.todayHeadline || `${milestone.title} is today.`,
    lede: milestone.todayLede || "Enjoy the moment!",
  };
};

/**
 * Update the milestone card display
 * @param {Object} dom - DOM elements object with milestone elements
 * @param {Array} milestones - Array of upcoming milestones
 * @param {string} timeZone - The timezone for date formatting
 * @param {Function} formatLongDateFromParts - Date formatting function
 * @param {Object} options - Options including resetIndex flag
 */
export const updateMilestoneCard = (
  dom,
  milestones,
  timeZone,
  formatLongDateFromParts,
  { resetIndex = true } = {}
) => {
  const { nextHeadline, nextDate, nextAway, milestone, milestoneToggle } = dom;

  setUpcomingMilestones(milestones);
  if (resetIndex) {
    setMilestoneIndex(0);
  } else {
    const currentIndex = getMilestoneIndex();
    if (currentIndex >= milestones.length) {
      setMilestoneIndex(0);
    }
  }
  setMilestoneTimeZone(timeZone);

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

  const index = getMilestoneIndex();
  const active = milestones[index];

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
        ? `Next milestone (${index + 1} of ${milestones.length})`
        : "Next milestone"
    );
  }
};

/**
 * Cycle to the next milestone
 * @param {Object} dom - DOM elements object
 * @param {Function} formatLongDateFromParts - Date formatting function
 * @param {string} fallbackTimeZone - Fallback timezone if not set
 */
export const cycleToNextMilestone = (dom, formatLongDateFromParts, fallbackTimeZone) => {
  const milestones = getUpcomingMilestones();
  if (!milestones.length) {
    return;
  }

  const currentIndex = getMilestoneIndex();
  const nextIndex = (currentIndex + 1) % milestones.length;
  setMilestoneIndex(nextIndex);

  const timeZone = dom.timeZone || fallbackTimeZone;
  updateMilestoneCard(dom, milestones, timeZone, formatLongDateFromParts, { resetIndex: false });
};

/**
 * Celebrate a milestone (launch confetti if not already celebrated)
 * @param {HTMLElement} confettiRoot - The confetti container element
 * @param {Object} milestone - The milestone to celebrate (null to reset)
 */
export const celebrateMilestone = (confettiRoot, milestone) => {
  if (!milestone) {
    setLastCelebratedKey(null);
    return;
  }
  const key = getMilestoneKey(milestone);
  if (!key) {
    setLastCelebratedKey(null);
    return;
  }
  if (key !== getLastCelebratedKey()) {
    setLastCelebratedKey(key);
    launchConfetti(confettiRoot);
  }
};

/**
 * Initialize milestone toggle button
 * @param {HTMLElement} milestoneToggle - The toggle button element
 * @param {Object} dom - DOM elements object
 * @param {Function} formatLongDateFromParts - Date formatting function
 * @param {string} fallbackTimeZone - Fallback timezone
 */
export const initializeMilestoneToggle = (
  milestoneToggle,
  dom,
  formatLongDateFromParts,
  fallbackTimeZone
) => {
  if (!milestoneToggle) {
    return;
  }
  milestoneToggle.addEventListener("click", () => {
    cycleToNextMilestone(dom, formatLongDateFromParts, fallbackTimeZone);
  });
};
