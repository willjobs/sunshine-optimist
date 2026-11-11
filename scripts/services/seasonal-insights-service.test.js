import { beforeAll, describe, it, expect } from "vitest";
import { createAstronomyContext } from "../utils/astronomy-utils.js";
import {
  addDaysToDateParts,
  compareDateParts,
  getDaysBetweenDateParts,
  formatDateInputValue,
} from "../utils/date-utils.js";
import {
  getDaylightAfter5pm,
  getRateFacts,
  getSeasonalContextAsync,
} from "./seasonal-insights-service.js";

beforeAll(async () => {
  const module = await import("../../astronomy-engine/astronomy.browser.js");
  if (!globalThis.Astronomy && module?.default) globalThis.Astronomy = module.default;
});
const boston = () =>
  createAstronomyContext({ latitude: 42.3601, longitude: -71.0589 }, "America/New_York");
const utcEvent = (date) => ({ date: new Date(date) });

describe("actual daylight after 5pm", () => {
  it("measures only the daylight interval after 5pm", () => {
    const date = { year: 2026, month: 1, day: 1 };
    expect(
      getDaylightAfter5pm(
        { sunrise: utcEvent("2026-01-01T08:00:00Z"), sunset: utcEvent("2026-01-01T18:00:00Z") },
        date,
        "UTC"
      )
    ).toBe(60);
    expect(
      getDaylightAfter5pm(
        { sunrise: utcEvent("2026-01-01T18:00:00Z"), sunset: utcEvent("2026-01-01T19:00:00Z") },
        date,
        "UTC"
      )
    ).toBe(60);
    expect(
      getDaylightAfter5pm(
        { sunrise: utcEvent("2026-01-01T08:00:00Z"), sunset: utcEvent("2026-01-01T16:00:00Z") },
        date,
        "UTC"
      )
    ).toBe(0);
  });
  it("caps an after-midnight sunset at local midnight", () => {
    const result = getDaylightAfter5pm(
      { sunrise: utcEvent("2026-01-01T08:00:00Z"), sunset: utcEvent("2026-01-02T01:00:00Z") },
      { year: 2026, month: 1, day: 1 },
      "UTC"
    );
    expect(result).toBe(7 * 60);
  });
  it("uses the selected timezone on the day clocks change", () => {
    const result = getDaylightAfter5pm(
      { sunrise: utcEvent("2026-03-08T11:00:00Z"), sunset: utcEvent("2026-03-08T23:00:00Z") },
      { year: 2026, month: 3, day: 8 },
      "America/New_York"
    );
    expect(result).toBe(120);
  });
  it("leaves missing events unknown", () => {
    expect(
      getDaylightAfter5pm({ sunrise: null, sunset: null }, { year: 2026, month: 1, day: 1 }, "UTC")
    ).toBeNull();
  });
});

describe("comparable daylight rates", () => {
  it("compares equal seven-day windows separated by four weeks", () => {
    const today = { year: 2026, month: 11, day: 15 };
    const values = new Map([
      [-14, 630],
      [-28, 700],
      [-35, 720],
    ]);
    const astronomy = {
      getDaylightMinutesForDateParts: (date) => values.get(getDaysBetweenDateParts(today, date)),
    };
    const facts = getRateFacts(astronomy, today, 600, 615);
    expect(facts.lossSlowdownPercent).toBe(25);
    expect(facts.gainsAccelerating).toBe(false);
  });
  it("requires positive and increasing weekly gains for acceleration", () => {
    const astronomy = { getDaylightMinutesForDateParts: () => 500 };
    expect(getRateFacts(astronomy, {}, 535, 515).gainsAccelerating).toBe(true);
    expect(getRateFacts(astronomy, {}, 530, 515).gainsAccelerating).toBe(false);
    expect(getRateFacts(astronomy, {}, 510, 500).gainsAccelerating).toBe(false);
    expect(
      getRateFacts({ getDaylightMinutesForDateParts: () => null }, {}, 600, null)
        .lossSlowdownPercent
    ).toBeNull();
  });
});

describe("seasonal winter insights with real astronomy", () => {
  for (const [label, latitude, longitude, timezone, hemisphere, winter, summer] of [
    [
      "Boston",
      42.3601,
      -71.0589,
      "America/New_York",
      "north",
      { year: 2026, month: 12, day: 21 },
      6,
    ],
    ["Sydney", -33.87, 151.21, "Australia/Sydney", "south", { year: 2026, month: 6, day: 21 }, 12],
  ]) {
    it(`${label}: starts celebrations on actual improving days and ranks the darkest 70`, async () => {
      const a = createAstronomyContext({ latitude, longitude }, timezone);
      const insights = await a.getWinterInsightsAsync(winter, hemisphere);
      expect(
        getDaysBetweenDateParts(insights.shortestDayDateParts, insights.longerDaysDateParts)
      ).toBe(1);
      expect(a.getDaylightMinutesForDateParts(insights.longerDaysDateParts)).toBeGreaterThan(
        insights.shortestDayMinutes
      );
      expect(
        getDaysBetweenDateParts(insights.earliestSunsetDateParts, insights.laterSunsetsDateParts)
      ).toBe(1);
      expect(a.getSunsetMinutesForDateParts(insights.laterSunsetsDateParts)).toBeGreaterThan(
        insights.earliestSunsetMinutes
      );
      expect(insights.darkestDates).toHaveLength(70);
      const keys = new Set(insights.darkestDates.map(formatDateInputValue));
      expect(keys.size).toBe(70);
      const start = a.getPreviousSeasonDateParts(winter, hemisphere, "summer");
      const end = a.getNextSeasonDateParts(winter, hemisphere, "summer");
      expect(start.month).toBe(summer);
      const selectedMax = Math.max(...insights.darkestDates.map(a.getDaylightMinutesForDateParts));
      for (let date = start; compareDateParts(date, end) < 0; date = addDaysToDateParts(date, 1)) {
        if (!keys.has(formatDateInputValue(date)))
          expect(a.getDaylightMinutesForDateParts(date)).toBeGreaterThanOrEqual(selectedMax);
      }
      for (const date of insights.darkestDates)
        expect(compareDateParts(date, insights.darkestWeeksFinishedDateParts)).toBe(-1);
      expect(await a.getWinterInsightsAsync(winter, hemisphere)).toBe(insights);
    });
  }
  it("keeps December sunset and daylight turnarounds in the correct winter across New Year", async () => {
    const a = boston();
    const december = await getSeasonalContextAsync(a, { year: 2026, month: 12, day: 15 }, "north");
    expect(december.pastSunset.winterParts.year).toBe(2026);
    expect(december.pastDaylight.winterParts.year).toBe(2025);
    expect(december.nextLongerDays).toEqual({ year: 2026, month: 12, day: 22 });
    const january = await getSeasonalContextAsync(a, { year: 2027, month: 1, day: 1 }, "north");
    expect(january.pastDaylight.winterParts.year).toBe(2026);
    expect(january.pastSunset.winterParts.year).toBe(2026);
  });
  it("selects precisely 70 brightest calendar dates, including southern year boundaries", async () => {
    const a = createAstronomyContext({ latitude: -33.87, longitude: 151.21 }, "Australia/Sydney");
    const dates = await a.getBrightestDayDatesAsync(2026);
    expect(new Set(dates).size).toBe(70);
    expect(dates.some((key) => key.startsWith("2026-01"))).toBe(true);
    expect(dates.some((key) => key.startsWith("2026-12"))).toBe(true);
    const selected = new Set(dates);
    const values = Array.from({ length: 365 }, (_, offset) => {
      const date = addDaysToDateParts({ year: 2026, month: 1, day: 1 }, offset);
      return { key: formatDateInputValue(date), value: a.getDaylightMinutesForDateParts(date) };
    });
    const selectedMin = Math.min(
      ...values.filter((day) => selected.has(day.key)).map((day) => day.value)
    );
    expect(
      Math.max(...values.filter((day) => !selected.has(day.key)).map((day) => day.value))
    ).toBeLessThanOrEqual(selectedMin);
  });
  it("does not finish darkest weeks before tied polar-night days are behind you", async () => {
    const a = createAstronomyContext(
      { latitude: 78.2232, longitude: 15.6469 },
      "Arctic/Longyearbyen"
    );
    const winter = { year: 2026, month: 12, day: 21 };
    const insights = await a.getWinterInsightsAsync(winter, "north");
    expect(insights.darkestDates).toHaveLength(70);
    expect(a.getPolarState(insights.darkestWeeksFinishedDateParts)).not.toBe("polar-night");
    const brightest = await a.getBrightestDayDatesAsync(2026);
    expect(brightest).toHaveLength(70);
    for (const key of brightest) {
      const [year, month, day] = key.split("-").map(Number);
      expect(a.getPolarState({ year, month, day })).toBe("polar-day");
    }
    // Existing statistics still expose absent events as unknown.
    expect(a.getDaylightMinutesForDateParts(winter)).toBeNull();
  });
});
