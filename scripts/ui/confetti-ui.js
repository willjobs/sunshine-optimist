/**
 * Confetti animation for milestone celebrations
 */

import { getConfettiTimeoutId, setConfettiTimeoutId } from "../state/app-state.js";

const CONFETTI_COLORS = ["#f94144", "#f3722c", "#f9c74f", "#90be6d", "#43aa8b", "#577590"];
const CONFETTI_COUNT = 72;

/**
 * Launch confetti animation
 * @param {HTMLElement} confettiRoot - The container element for confetti
 */
export const launchConfetti = (confettiRoot) => {
  if (!confettiRoot) {
    return;
  }

  confettiRoot.replaceChildren();

  const existingTimeoutId = getConfettiTimeoutId();
  if (existingTimeoutId) {
    window.clearTimeout(existingTimeoutId);
    setConfettiTimeoutId(null);
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
    piece.style.setProperty("--confetti-color", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    piece.style.setProperty("--confetti-delay", `${delay.toFixed(2)}s`);
    piece.style.setProperty("--confetti-duration", `${duration.toFixed(2)}s`);
    piece.style.setProperty("--confetti-drift", `${drift}px`);
    piece.style.setProperty("--confetti-rotate", `${rotate}deg`);
    piece.style.setProperty("--confetti-spin", `${spin}deg`);
    fragment.appendChild(piece);
    maxDuration = Math.max(maxDuration, duration + delay);
  }

  confettiRoot.appendChild(fragment);

  const timeoutId = window.setTimeout(
    () => {
      confettiRoot.replaceChildren();
      setConfettiTimeoutId(null);
    },
    (maxDuration + 0.5) * 1000
  );

  setConfettiTimeoutId(timeoutId);
};
