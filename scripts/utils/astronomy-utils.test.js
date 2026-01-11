import { describe, it, expect } from "vitest";
import { createAstronomyContext } from "./astronomy-utils.js";

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

    // Shortest day should be in November or December, not August
    // The bug incorrectly picked August 14
    if (extremes.shortestDayDateParts) {
      expect(extremes.shortestDayDateParts.month).toBeGreaterThanOrEqual(11);
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
});
