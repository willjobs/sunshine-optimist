// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as dateController from "./date-controller.js";
import {
  getCustomDateParts,
  isUsingLiveDate,
  setCustomDateParts,
  setUseLiveDate,
  setActiveLocation,
  setLastKeydownAt,
} from "../state/app-state.js";

const buildDom = () => {
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  const dateReset = document.createElement("button");
  const datePicker = document.createElement("div");
  datePicker.className = "date-picker";
  return { dateInput, dateReset, datePicker };
};

beforeEach(() => {
  setUseLiveDate(true);
  setCustomDateParts(null);
  setActiveLocation(null);
  dateController.setDateChangeCallback(null);
});

afterEach(() => {
  dateController.clearDateCommitTimeout();
  dateController.clearLiveDateRefreshTimeout?.();
  vi.useRealTimers();
});

describe("date-controller", () => {
  it("applies date selection changes", () => {
    expect(dateController.applyDateSelection(null)).toBe(false);
    expect(isUsingLiveDate()).toBe(true);

    const changed = dateController.applyDateSelection({ year: 2024, month: 6, day: 1 });
    expect(changed).toBe(true);
    expect(isUsingLiveDate()).toBe(false);
    expect(getCustomDateParts()).toEqual({ year: 2024, month: 6, day: 1 });

    const noChange = dateController.applyDateSelection({ year: 2024, month: 6, day: 1 });
    expect(noChange).toBe(false);
  });

  it("rejects out-of-range dates", () => {
    expect(dateController.applyDateSelection({ year: 1899, month: 12, day: 31 })).toBe(false);
    expect(isUsingLiveDate()).toBe(true);
    expect(dateController.applyDateSelection({ year: 2101, month: 1, day: 1 })).toBe(false);
    expect(isUsingLiveDate()).toBe(true);
    expect(dateController.applyDateSelection({ year: 1900, month: 1, day: 1 })).toBe(true);
    expect(dateController.applyDateSelection({ year: 2100, month: 12, day: 31 })).toBe(true);
  });

  it("syncs date picker UI state", () => {
    const { dateInput, dateReset, datePicker } = buildDom();
    setUseLiveDate(false);
    setCustomDateParts({ year: 2024, month: 6, day: 2 });

    dateController.syncDatePicker(dateInput, dateReset, datePicker, "UTC");
    expect(dateInput.value).toBe("2024-06-02");
    expect(dateReset.disabled).toBe(false);
    expect(datePicker.classList.contains("is-custom")).toBe(true);
  });

  it("commits a date selection and notifies the callback", () => {
    const { dateInput, dateReset, datePicker } = buildDom();
    dateInput.value = "2024-06-03";

    const location = { name: "Test City", timezone: "UTC" };
    setActiveLocation(location);

    const onChange = vi.fn();
    dateController.setDateChangeCallback(onChange);

    dateController.commitDateSelection(dateInput, dateReset, datePicker, "UTC");
    expect(onChange).toHaveBeenCalledWith(location);

    dateController.commitDateSelection(dateInput, dateReset, datePicker, "UTC");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("debounces date commits and respects keyboard grace period", () => {
    const { dateInput, dateReset, datePicker } = buildDom();
    dateInput.value = "2024-06-04";

    vi.useFakeTimers();
    dateController.scheduleDateCommit(dateInput, dateReset, datePicker, "UTC");
    vi.advanceTimersByTime(300);
    expect(isUsingLiveDate()).toBe(false);

    const now = Date.now();
    setLastKeydownAt(now - 100);
    expect(dateController.isRecentDateKeyboardInput()).toBe(true);
    setLastKeydownAt(now - 2000);
    expect(dateController.isRecentDateKeyboardInput()).toBe(false);
  });

  it("refreshes live daylight when the selected city reaches midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T14:59:55Z"));
    const location = { name: "Tokyo", timezone: "Asia/Tokyo" };
    setActiveLocation(location);
    const onChange = vi.fn();
    dateController.setDateChangeCallback(onChange);

    dateController.scheduleLiveDateRefresh("UTC");
    vi.advanceTimersByTime(6000);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(location);
  });

  it("catches a missed midnight when the tab becomes visible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T14:00:00Z"));
    const location = { name: "Tokyo", timezone: "Asia/Tokyo" };
    setActiveLocation(location);
    const onChange = vi.fn();
    dateController.setDateChangeCallback(onChange);
    dateController.scheduleLiveDateRefresh("UTC");

    vi.setSystemTime(new Date("2026-09-28T15:00:01Z"));
    dateController.refreshLiveDateIfNeeded("UTC");

    expect(onChange).toHaveBeenCalledOnce();
  });
});
