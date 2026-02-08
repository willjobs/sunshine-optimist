import { beforeAll, describe, it, expect } from "vitest";
import { createAstronomyContext } from "./astronomy-utils.js";
import {
  addDaysToDateParts,
  getDaysBetweenDateParts,
  getDaysInYear,
  getLocalDateParts,
  getMinutesSinceMidnight,
} from "./date-utils.js";

beforeAll(async () => {
  if (globalThis.Astronomy) {
    return;
  }
  const module = await import("../../astronomy-engine/astronomy.browser.js");
  if (!globalThis.Astronomy && module?.default) {
    globalThis.Astronomy = module.default;
  }
});

describe("astronomy-utils", () => {
  it("returns fallback values when Astronomy is unavailable", async () => {
    const original = globalThis.Astronomy;
    try {
      delete globalThis.Astronomy;
      const context = createAstronomyContext({ latitude: 0, longitude: 0 }, "UTC");
      const events = context.getSunEvents({ year: 2024, month: 1, day: 1 });
      expect(events.sunrise).toBe(null);
      expect(events.sunset).toBe(null);

      const extremes = context.getYearlySunExtremes(2024, null);
      expect(extremes.earliestSunsetMinutes).toBe(null);

      const asyncExtremes = await context.getYearlySunExtremesAsync(2024, null);
      expect(asyncExtremes.shortestDayMinutes).toBe(null);
    } finally {
      if (original) {
        globalThis.Astronomy = original;
      }
    }
  });
});

describe("polar region daylight calculations", () => {
  const barrow = { latitude: 71.29058, longitude: -156.78873 };
  const timeZone = "America/Anchorage";
  const findNextDaySunset = (context, year) => {
    const yearStart = { year, month: 1, day: 1 };
    const daysInYear = getDaysInYear(year);
    for (let offset = 0; offset < daysInYear; offset += 1) {
      const dateParts = addDaysToDateParts(yearStart, offset);
      const events = context.getSunEvents(dateParts);
      if (!events.sunset) {
        continue;
      }
      const sunsetDateParts = getLocalDateParts(events.sunset.date, timeZone);
      if (getDaysBetweenDateParts(dateParts, sunsetDateParts) === 1) {
        return { dateParts, sunsetDate: events.sunset.date };
      }
    }
    return null;
  };

  it("does not produce spuriously short daylight on polar transition days", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const daylight = context.getDaylightMinutesForDateParts({
      year: 2026,
      month: 8,
      day: 14,
    });

    // The bug produced ~296 minutes (4h 56m) - which is incorrect
    // Expect null (transition day) or a reasonable value (> 10 hours)
    expect(daylight === null || daylight > 600).toBe(true);
  });

  it("finds correct shortest day in year 2026 (not in August)", async () => {
    const context = createAstronomyContext(barrow, timeZone);
    const extremes = await context.getYearlySunExtremesAsync(2026, null);

    // Shortest day should land in deep winter (not August)
    // The bug incorrectly picked August 14
    if (extremes.shortestDayDateParts) {
      expect([11, 12, 1, 2]).toContain(extremes.shortestDayDateParts.month);
    }
  });

  it("returns null for both sunrise and sunset during polar night", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const events = context.getSunEvents({ year: 2026, month: 12, day: 21 });

    // During polar night (winter solstice), expect null sunrise and sunset
    expect(events.sunrise).toBe(null);
    expect(events.sunset).toBe(null);
  });

  it("returns null for both sunrise and sunset during polar day", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const events = context.getSunEvents({ year: 2026, month: 6, day: 21 });

    // During polar day (summer solstice), expect null sunrise and sunset
    expect(events.sunrise).toBe(null);
    expect(events.sunset).toBe(null);
  });

  it("calculates reasonable daylight for November 18 (actual short day)", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const daylight = context.getDaylightMinutesForDateParts({
      year: 2026,
      month: 11,
      day: 18,
    });

    // November 18 should have very short daylight (around 1 hour = 60 mins)
    // or null if it's already polar night
    expect(daylight === null || daylight < 120).toBe(true);
  });

  it("calculates reasonable daylight for August 15", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const daylight = context.getDaylightMinutesForDateParts({
      year: 2026,
      month: 8,
      day: 15,
    });

    // August 15 should have long daylight (reported as 18h 44m = 1124 mins)
    // or null if it's a transition day
    expect(daylight === null || daylight > 600).toBe(true);
  });

  it("finds sunset threshold milestones after polar night", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const winterSolstice = context.getPreviousSeasonDateParts(
      { year: 2026, month: 1, day: 30 },
      "north",
      "winter"
    );
    const match = context.findFirstSunsetAfter(winterSolstice, 16 * 60);
    expect(match).not.toBe(null);
    const sunsetMinutes = context.getSunsetMinutesForDateParts(match?.dateParts);
    expect(sunsetMinutes).not.toBe(null);
    expect(sunsetMinutes).toBeGreaterThanOrEqual(16 * 60);
  });

  it("finds daylight duration milestones after polar night", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const winterSolstice = context.getPreviousSeasonDateParts(
      { year: 2026, month: 1, day: 30 },
      "north",
      "winter"
    );
    const match = context.findFirstDaylightAtLeast(winterSolstice, 10 * 60);
    expect(match).not.toBe(null);
    const daylight = context.getDaylightMinutesForDateParts(match?.dateParts);
    expect(daylight).not.toBe(null);
    expect(daylight).toBeGreaterThanOrEqual(10 * 60);
  });

  it("finds daylight gain milestones after polar night", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const winterSolstice = context.getPreviousSeasonDateParts(
      { year: 2026, month: 1, day: 30 },
      "north",
      "winter"
    );
    const match = context.findFirstDaylightGain(winterSolstice, 30);
    expect(match).not.toBe(null);
    const daylight = context.getDaylightMinutesForDateParts(match?.dateParts);
    expect(daylight).not.toBe(null);
    expect(daylight).toBeGreaterThanOrEqual(30);
  });

  it("normalizes next-day sunsets beyond 24h for threshold and extremes logic", () => {
    const context = createAstronomyContext(barrow, timeZone);
    const nextDaySunset = findNextDaySunset(context, 2026);
    expect(nextDaySunset).not.toBe(null);
    if (!nextDaySunset) {
      return;
    }

    const rawMinutes = getMinutesSinceMidnight(nextDaySunset.sunsetDate, timeZone);
    const normalizedMinutes = context.getSunsetMinutesForDateParts(nextDaySunset.dateParts);
    expect(rawMinutes).toBeLessThan(24 * 60);
    expect(normalizedMinutes).toBeGreaterThanOrEqual(24 * 60);
    expect(normalizedMinutes - rawMinutes).toBeCloseTo(24 * 60, 5);
  });
});
