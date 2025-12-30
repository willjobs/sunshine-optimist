/**
 * Optimistic message display and rotation
 */

import { setText } from "../dom-utils.js";
import {
  getOptimisticOptions,
  setOptimisticOptions,
  getOptimisticIndex,
  setOptimisticIndex,
  getRotationId,
  setRotationId,
  getSwapId,
  incrementSwapId,
  getSwapTimeoutId,
  setSwapTimeoutId,
} from "../state/app-state.js";

const OPTIMISTIC_ROTATION_MS = 15000;
const OPTIMISTIC_OUT_CLASS = "is-optimistic-out";
const OPTIMISTIC_IN_CLASS = "is-optimistic-in";
const OPTIMISTIC_OUT_DURATION_MS = 320;

export const OPTIMISTIC_POLAR_COPY = {
  headline: "Sunlight looks different here.",
  lede: "No sunrise or sunset today.",
};

export const OPTIMISTIC_FALLBACK_COPY = {
  headline: "Enjoy the daylight today.",
  lede: "Every bit of sunshine helps.",
};

/**
 * Check if user prefers reduced motion
 */
const prefersReducedMotion = () => {
  if (!window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Clear the optimistic message swap timeout
 */
const clearOptimisticSwapTimeout = () => {
  const swapTimeoutId = getSwapTimeoutId();
  if (swapTimeoutId) {
    window.clearTimeout(swapTimeoutId);
    setSwapTimeoutId(null);
  }
};

/**
 * Clear the optimistic message rotation interval
 */
const clearOptimisticRotation = () => {
  const rotationId = getRotationId();
  if (rotationId) {
    window.clearInterval(rotationId);
    setRotationId(null);
  }
};

/**
 * Reset animation classes on message elements
 */
const resetOptimisticAnimation = (headline, lede) => {
  clearOptimisticSwapTimeout();
  incrementSwapId();
  [headline, lede].forEach((node) => {
    if (!node) {
      return;
    }
    node.classList.remove(OPTIMISTIC_OUT_CLASS, OPTIMISTIC_IN_CLASS);
  });
};

/**
 * Set optimistic copy immediately without animation
 */
const setOptimisticCopyImmediate = (headline, lede, copy) => {
  if (!copy) {
    return;
  }
  resetOptimisticAnimation(headline, lede);
  setText(headline, copy.headline);
  setText(lede, copy.lede);
};

/**
 * Animate the optimistic message swap
 */
const animateOptimisticSwap = (headline, lede, copy) => {
  if (!copy) {
    return;
  }
  if (!headline || !lede || prefersReducedMotion()) {
    setOptimisticCopyImmediate(headline, lede, copy);
    return;
  }

  resetOptimisticAnimation(headline, lede);
  const swapId = getSwapId();

  [headline, lede].forEach((node) => {
    if (!node) {
      return;
    }
    node.classList.remove(OPTIMISTIC_IN_CLASS);
    void node.offsetWidth;
    node.classList.add(OPTIMISTIC_OUT_CLASS);
  });

  const timeoutId = window.setTimeout(() => {
    if (swapId !== getSwapId()) {
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

  setSwapTimeoutId(timeoutId);
};

/**
 * Set optimistic copy with optional animation
 * @param {HTMLElement} headline - The headline element
 * @param {HTMLElement} lede - The lede element
 * @param {Object} copy - The copy object with headline and lede
 * @param {Object} options - Options including animate flag
 */
export const setOptimisticCopy = (headline, lede, copy, { animate = false } = {}) => {
  if (!copy) {
    return;
  }
  if (!animate) {
    setOptimisticCopyImmediate(headline, lede, copy);
    return;
  }
  animateOptimisticSwap(headline, lede, copy);
};

/**
 * Stop the optimistic message rotation
 */
export const stopOptimisticRotation = (headline, lede) => {
  clearOptimisticRotation();
  resetOptimisticAnimation(headline, lede);
  setOptimisticOptions([]);
  setOptimisticIndex(0);
};

/**
 * Start the optimistic message rotation
 * @param {HTMLElement} headline - The headline element
 * @param {HTMLElement} lede - The lede element
 * @param {Array} messages - Array of message objects
 */
export const startOptimisticRotation = (headline, lede, messages) => {
  stopOptimisticRotation(headline, lede);
  const options = Array.isArray(messages) ? messages : [];
  setOptimisticOptions(options);

  if (!options.length) {
    return;
  }

  setOptimisticIndex(0);
  setOptimisticCopy(headline, lede, options[0], { animate: false });

  if (options.length < 2) {
    return;
  }

  const rotationId = window.setInterval(() => {
    const currentOptions = getOptimisticOptions();
    const currentIndex = getOptimisticIndex();
    const nextIndex = (currentIndex + 1) % currentOptions.length;
    setOptimisticIndex(nextIndex);
    setOptimisticCopy(headline, lede, currentOptions[nextIndex], { animate: true });
  }, OPTIMISTIC_ROTATION_MS);

  setRotationId(rotationId);
};
