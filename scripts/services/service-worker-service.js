import {
  getCustomDateParts,
  isUsingLiveDate,
  setCustomDateParts,
  setUseLiveDate,
} from "../state/app-state.js";
import { formatDateInputValue, parseDateInputValue } from "../utils/date-utils.js";

const RELOAD_DATE_KEY = "sunshine-optimist:update-date";

// One-shot handoff for app-triggered reloads; ordinary visits still start live.
export const preserveDateForUpdate = () => {
  try {
    sessionStorage.removeItem(RELOAD_DATE_KEY);
    if (!isUsingLiveDate() && getCustomDateParts()) {
      sessionStorage.setItem(RELOAD_DATE_KEY, formatDateInputValue(getCustomDateParts()));
    }
  } catch {
    // Private browsing/storage policies must not prevent an app update.
  }
};

export const restoreDateAfterUpdate = () => {
  try {
    const value = sessionStorage.getItem(RELOAD_DATE_KEY);
    sessionStorage.removeItem(RELOAD_DATE_KEY);
    const parts = parseDateInputValue(value || "");
    const date = parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : null;
    if (
      parts &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      parts.year >= 1900 &&
      parts.year <= 2100 &&
      date.getUTCFullYear() === parts.year &&
      date.getUTCMonth() + 1 === parts.month &&
      date.getUTCDate() === parts.day
    ) {
      setCustomDateParts(parts);
      setUseLiveDate(false);
    }
  } catch {
    // Continue with the default live date if storage is unavailable.
  }
};

export const initializeServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;
    isRefreshing = true;
    preserveDateForUpdate();
    window.location.reload();
  });
  const register = () =>
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((error) => console.warn("Service Worker registration failed:", error));
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
};
