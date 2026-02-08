import { describe, it, expect } from "vitest";
import {
  formatDateInputValue,
  parseDateInputValue,
  addDaysToDateParts,
  addMonthsToDateParts,
  getDaysBetweenDateParts,
  getDaysInYear,
  compareDateParts,
  getMinutesSinceMidnight,
  shiftMonth,
  getAdjustedMonth,
} from "./date-utils.js";

describe("date-utils", () => {
  it("formats and parses date input values", () => {
    expect(formatDateInputValue(null)).toBe("");
    expect(formatDateInputValue({ year: 2024, month: 5, day: 9 })).toBe("2024-05-09");

    expect(parseDateInputValue("")).toBe(null);
    expect(parseDateInputValue("2024-05-09")).toEqual({ year: 2024, month: 5, day: 9 });
  });

  it("adds days across month boundaries", () => {
    const result = addDaysToDateParts({ year: 2024, month: 3, day: 1 }, -1);
    expect(result).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("adds months and clamps to valid day", () => {
    const result = addMonthsToDateParts({ year: 2024, month: 1, day: 31 }, 1);
    expect(result).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("compares date parts and calculates day counts", () => {
    expect(
      compareDateParts({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 2 })
    ).toBe(-1);
    expect(
      compareDateParts({ year: 2024, month: 1, day: 2 }, { year: 2024, month: 1, day: 1 })
    ).toBe(1);
    expect(
      compareDateParts({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 1 })
    ).toBe(0);
    expect(
      getDaysBetweenDateParts({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 10 })
    ).toBe(9);
    expect(getDaysInYear(2024)).toBe(366);
  });

  it("gets minutes since midnight in a timezone", () => {
    const date = new Date(Date.UTC(2024, 0, 1, 12, 30, 0));
    expect(getMinutesSinceMidnight(date, "UTC")).toBe(750);
  });

  it("shifts months and adjusts for hemisphere", () => {
    expect(shiftMonth(1, -1)).toBe(12);
    expect(shiftMonth(1, -2)).toBe(11);
    expect(shiftMonth(3, -3)).toBe(12);
    expect(shiftMonth(7, -12)).toBe(7);
    expect(shiftMonth(12, 1)).toBe(1);
    expect(shiftMonth(6, 6)).toBe(12);
    expect(getAdjustedMonth(1, "south")).toBe(7);
    expect(getAdjustedMonth(1, "north")).toBe(1);
  });
});
