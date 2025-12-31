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
