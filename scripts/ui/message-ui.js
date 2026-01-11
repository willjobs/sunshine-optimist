/**
 * Optimistic message display and rotation
 */

import { setText } from "../utils/dom-utils.js";
import { formatDaysValue } from "../formatters/formatters.js";
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
const OPTIMISTIC_SWIPE_THRESHOLD_PX = 48;
const OPTIMISTIC_SWIPE_RESTRAINT_PX = 64;

const shuffleOptimisticMessages = (messages) => {
  const shuffled = [...messages];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const normalizeOptimisticControls = (controls = {}) => ({
  container: controls.container || null,
  dots: controls.dots || null,
  prevButton: controls.prevButton || null,
  nextButton: controls.nextButton || null,
});

const optimisticNavState = {
  headline: null,
  lede: null,
  controls: normalizeOptimisticControls(),
  handlers: null,
  pointer: {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  },
};

export const OPTIMISTIC_POLAR_COPY = {
  headline: "Sunlight looks different here.",
  lede: "No sunrise or sunset today.",
};

export const OPTIMISTIC_POLAR_DAY_COPY = {
  headline: "Enjoy the 24 hours of daylight.",
  lede: "Remember to wear sunscreen!",
};

export const createPolarNightCopy = (daysUntilSunrise) => ({
  headline: Number.isFinite(daysUntilSunrise)
    ? `Sunlight will return in ${formatDaysValue(daysUntilSunrise)}.`
    : "The sun will return soon.",
  lede: "This isn't forever.",
});

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

const clearHeadlineLoadingState = (headline) => {
  if (!headline) {
    return;
  }
  headline.removeAttribute("data-loading");
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
  clearHeadlineLoadingState(headline);
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
    clearHeadlineLoadingState(headline);
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
 * Update optimistic message indicator dots
 */
const updateOptimisticDots = (dots, count, index) => {
  if (!dots) {
    return;
  }
  const currentCount = Number(dots.dataset.count || "0");
  if (currentCount !== count) {
    const nextDots = Array.from({ length: count }, (_, dotIndex) => {
      const dot = document.createElement("span");
      dot.className = "optimistic-dot";
      dot.dataset.index = String(dotIndex);
      return dot;
    });
    dots.replaceChildren(...nextDots);
    dots.dataset.count = String(count);
  }
  const dotNodes = dots.querySelectorAll(".optimistic-dot");
  dotNodes.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === index);
  });
};

/**
 * Update navigation controls for optimistic messages
 */
const updateOptimisticControls = (controls, count, index) => {
  if (!controls) {
    return;
  }
  const normalized = normalizeOptimisticControls(controls);
  const isMulti = count > 1;
  if (normalized.container) {
    normalized.container.classList.toggle("is-optimistic-multi", isMulti);
  }
  [normalized.prevButton, normalized.nextButton, normalized.dots].forEach((node) => {
    if (!node) {
      return;
    }
    if (isMulti) {
      node.removeAttribute("hidden");
    } else {
      node.setAttribute("hidden", "true");
    }
  });
  if (!isMulti) {
    if (normalized.dots) {
      normalized.dots.replaceChildren();
      normalized.dots.dataset.count = "0";
    }
    return;
  }
  updateOptimisticDots(normalized.dots, count, index);
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
 * Apply a selected optimistic message index
 */
const applyOptimisticIndex = (
  headline,
  lede,
  index,
  { animate = true, controls = optimisticNavState.controls } = {}
) => {
  const options = getOptimisticOptions();
  const resolvedControls = controls || optimisticNavState.controls;
  if (!options.length) {
    updateOptimisticControls(resolvedControls, 0, 0);
    return;
  }
  const boundedIndex = ((index % options.length) + options.length) % options.length;
  setOptimisticIndex(boundedIndex);
  setOptimisticCopy(headline, lede, options[boundedIndex], { animate });
  updateOptimisticControls(resolvedControls, options.length, boundedIndex);
};

/**
 * Schedule optimistic message rotation
 */
const scheduleOptimisticRotation = (headline, lede, controls) => {
  clearOptimisticRotation();
  const options = getOptimisticOptions();
  if (options.length < 2) {
    return;
  }
  const rotationId = window.setInterval(() => {
    const currentOptions = getOptimisticOptions();
    if (currentOptions.length < 2) {
      updateOptimisticControls(
        controls || optimisticNavState.controls,
        currentOptions.length,
        getOptimisticIndex()
      );
      return;
    }
    const currentIndex = getOptimisticIndex();
    const nextIndex = (currentIndex + 1) % currentOptions.length;
    applyOptimisticIndex(headline, lede, nextIndex, { animate: true, controls });
  }, OPTIMISTIC_ROTATION_MS);

  setRotationId(rotationId);
};

/**
 * Navigate optimistic messages manually
 */
const navigateOptimisticMessage = (direction) => {
  const { headline, lede, controls } = optimisticNavState;
  const options = getOptimisticOptions();
  if (!headline && !lede) {
    return;
  }
  if (options.length < 2) {
    return;
  }
  const currentIndex = getOptimisticIndex();
  const nextIndex = (currentIndex + direction + options.length) % options.length;
  applyOptimisticIndex(headline, lede, nextIndex, { animate: true, controls });
  scheduleOptimisticRotation(headline, lede, controls);
};

const resetOptimisticPointer = () => {
  optimisticNavState.pointer.active = false;
  optimisticNavState.pointer.pointerId = null;
  optimisticNavState.pointer.startX = 0;
  optimisticNavState.pointer.startY = 0;
};

const clearOptimisticNavigationHandlers = () => {
  if (!optimisticNavState.handlers) {
    return;
  }
  const { controls, handlers } = optimisticNavState;
  if (controls.prevButton) {
    controls.prevButton.removeEventListener("click", handlers.onPrev);
  }
  if (controls.nextButton) {
    controls.nextButton.removeEventListener("click", handlers.onNext);
  }
  if (controls.container) {
    controls.container.removeEventListener("pointerdown", handlers.onPointerDown);
    controls.container.removeEventListener("pointerup", handlers.onPointerUp);
    controls.container.removeEventListener("pointercancel", handlers.onPointerCancel);
  }
  optimisticNavState.handlers = null;
  resetOptimisticPointer();
};

const bindOptimisticNavigation = (headline, lede, controls) => {
  if (headline) {
    optimisticNavState.headline = headline;
  }
  if (lede) {
    optimisticNavState.lede = lede;
  }

  const normalized = normalizeOptimisticControls(controls);
  const controlsChanged = ["container", "dots", "prevButton", "nextButton"].some(
    (key) => normalized[key] !== optimisticNavState.controls[key]
  );
  const hasControls = Object.values(normalized).some(Boolean);

  if (!hasControls) {
    if (controlsChanged) {
      clearOptimisticNavigationHandlers();
    }
    optimisticNavState.controls = normalized;
    return;
  }

  if (!controlsChanged && optimisticNavState.handlers) {
    optimisticNavState.controls = normalized;
    return;
  }

  clearOptimisticNavigationHandlers();
  optimisticNavState.controls = normalized;

  const onPrev = () => navigateOptimisticMessage(-1);
  const onNext = () => navigateOptimisticMessage(1);
  const onPointerDown = (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }
    if (!event.isPrimary) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest(".optimistic-nav")) {
      return;
    }
    const options = getOptimisticOptions();
    if (options.length < 2) {
      return;
    }
    optimisticNavState.pointer.active = true;
    optimisticNavState.pointer.pointerId = event.pointerId;
    optimisticNavState.pointer.startX = event.clientX;
    optimisticNavState.pointer.startY = event.clientY;
    if (normalized.container?.setPointerCapture) {
      normalized.container.setPointerCapture(event.pointerId);
    }
  };
  const onPointerUp = (event) => {
    if (!optimisticNavState.pointer.active) {
      return;
    }
    if (optimisticNavState.pointer.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - optimisticNavState.pointer.startX;
    const deltaY = event.clientY - optimisticNavState.pointer.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX >= OPTIMISTIC_SWIPE_THRESHOLD_PX && absY <= OPTIMISTIC_SWIPE_RESTRAINT_PX) {
      navigateOptimisticMessage(deltaX > 0 ? -1 : 1);
    }
    if (normalized.container?.hasPointerCapture?.(event.pointerId)) {
      normalized.container.releasePointerCapture(event.pointerId);
    }
    resetOptimisticPointer();
  };
  const onPointerCancel = (event) => {
    if (normalized.container?.hasPointerCapture?.(event.pointerId)) {
      normalized.container.releasePointerCapture(event.pointerId);
    }
    resetOptimisticPointer();
  };

  if (normalized.prevButton) {
    normalized.prevButton.addEventListener("click", onPrev);
  }
  if (normalized.nextButton) {
    normalized.nextButton.addEventListener("click", onNext);
  }
  if (normalized.container) {
    normalized.container.addEventListener("pointerdown", onPointerDown);
    normalized.container.addEventListener("pointerup", onPointerUp);
    normalized.container.addEventListener("pointercancel", onPointerCancel);
  }

  optimisticNavState.handlers = {
    onPrev,
    onNext,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  };
};

/**
 * Stop the optimistic message rotation
 */
export const stopOptimisticRotation = (headline, lede, controls) => {
  clearOptimisticRotation();
  resetOptimisticAnimation(headline, lede);
  setOptimisticOptions([]);
  setOptimisticIndex(0);
  const resolvedControls = controls
    ? normalizeOptimisticControls(controls)
    : optimisticNavState.controls;
  updateOptimisticControls(resolvedControls, 0, 0);
};

/**
 * Start the optimistic message rotation
 * @param {HTMLElement} headline - The headline element
 * @param {HTMLElement} lede - The lede element
 * @param {Array} messages - Array of message objects
 * @param {Object} controls - Navigation controls for optimistic messages
 */
export const startOptimisticRotation = (headline, lede, messages, controls) => {
  stopOptimisticRotation(headline, lede, controls);
  bindOptimisticNavigation(headline, lede, controls);
  const options = Array.isArray(messages) ? shuffleOptimisticMessages(messages) : [];
  setOptimisticOptions(options);

  if (!options.length) {
    updateOptimisticControls(optimisticNavState.controls, 0, 0);
    return;
  }

  applyOptimisticIndex(headline, lede, 0, {
    animate: false,
    controls: optimisticNavState.controls,
  });
  scheduleOptimisticRotation(headline, lede, optimisticNavState.controls);
};
