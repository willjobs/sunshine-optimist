/**
 * Delta tooltip behavior for stats comparison references
 */

import { getText } from "../utils/dom-utils.js";

/**
 * Close all delta tooltips except the specified one
 * @param {HTMLElement[]} targets - Array of tooltip target elements
 * @param {HTMLElement|null} exceptTarget - Target to exclude from closing
 */
export const closeDeltaTooltips = (targets, exceptTarget = null) => {
  targets.forEach((target) => {
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

/**
 * Build aria-label for tooltip combining visible text and tooltip content
 */
const buildDeltaTooltipAriaLabel = (target, tooltipText) => {
  const line = target.closest(".delta-line");
  const lineText = line ? getText(line) : getText(target);
  return [lineText, tooltipText].filter(Boolean).join(". ");
};

/**
 * Update tooltip pointer position based on client coordinates
 */
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

/**
 * Update tooltip attributes and visibility
 * @param {HTMLElement} target - The tooltip target element
 * @param {string} tooltipText - The tooltip content (empty to hide)
 */
export const updateDeltaTooltip = (target, tooltipText) => {
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

/**
 * Initialize tooltip event handlers for a target element
 * @param {HTMLElement} target - The tooltip target element
 * @param {HTMLElement[]} allTargets - All tooltip targets for closing others
 */
export const initializeTooltipTarget = (target, allTargets) => {
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
      closeDeltaTooltips(allTargets, target);
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
        closeDeltaTooltips(allTargets, target);
      }
    } else if (event.key === "Escape") {
      target.classList.remove("is-tooltip-open");
      target.setAttribute("aria-expanded", "false");
    }
  });
};

/**
 * Initialize global tooltip event handlers
 * @param {HTMLElement[]} allTargets - All tooltip targets
 */
export const initializeGlobalTooltipHandlers = (allTargets) => {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(".delta-reference.has-tooltip")) {
      closeDeltaTooltips(allTargets);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDeltaTooltips(allTargets);
    }
  });
};
