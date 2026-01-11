// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildUpcomingMilestones, calculateDeltas, updateStatsUI } from "./daylight-controller.js";

const buildStatsDom = () => {
  const makeValue = () => document.createElement("span");
  const makeRow = () => document.createElement("div");
  return {
    sunsetTimeValue: makeValue(),
    sunsetEarliestDeltaValue: makeValue(),
    daylightDurationValue: makeValue(),
    daylightShortestDeltaValue: makeValue(),
    sunsetEarliestRow: makeRow(),
    daylightShortestRow: makeRow(),
    sunsetComparisonRow: makeRow(),
    daylightComparisonRow: makeRow(),
    sunsetComparisonReference: makeValue(),
    daylightComparisonReference: makeValue(),
    sunsetComparisonDeltaValue: makeValue(),
    daylightComparisonDeltaValue: makeValue(),
    sunsetEarliestReference: makeValue(),
    sunsetComparisonReference: makeValue(),
    daylightShortestReference: makeValue(),
    daylightComparisonReference: makeValue(),
  };
};

const buildStatsMetrics = (overrides = {}) => ({
  todayEvents: { sunset: null },
  weekEvents: { sunset: null },
  monthEvents: { sunset: null },
  weekParts: { year: 2026, month: 1, day: 1 },
  monthParts: { year: 2026, month: 1, day: 1 },
  todayDaylight: null,
  weekDaylight: null,
  monthDaylight: null,
  referenceYear: 2026,
  yearlyExtremes: {
    earliestSunsetMinutes: null,
    earliestSunsetDateParts: null,
    shortestDayMinutes: null,
    shortestDayDateParts: null,
  },
  ...overrides,
});

const baseDeltas = {
  sunsetEarliestDelta: null,
  daylightShortestDelta: null,
  comparisonMode: "none",
  sunsetComparisonDelta: null,
  daylightComparisonDelta: null,
};

const stubFormatters = {
  formatTime: () => "5:00 PM",
  formatTimeFromMinutes: () => "5:00 PM",
  formatShortDateFromParts: () => "Jan 1",
};

const buildAstronomyStub = ({ sunriseDateParts = null, sunsetDateParts = null } = {}) => ({
  getPreviousSeasonDateParts: () => ({ year: 2026, month: 12, day: 1 }),
  findFirstSunsetAfter: () => null,
  getNextSeasonDateParts: () => null,
  findNextDaylightSavingsStart: () => null,
  findFirstDaylightAtLeast: () => null,
  findFirstDaylightGain: () => null,
  getYearlySunExtremes: () => ({
    earliestSunsetDateParts: null,
    shortestDayDateParts: null,
    longestDayDateParts: null,
  }),
  getNextHalfHour: () => null,
  findNextSunsetThreshold: () => null,
  findFirstSunrise: () =>
    sunriseDateParts ? { dateParts: sunriseDateParts, offsetDays: 10 } : null,
  findFirstSunset: () =>
    sunsetDateParts ? { dateParts: sunsetDateParts, offsetDays: 10 } : null,
});

describe("daylight-controller", () => {
  it("selects month comparison when deltas are positive", () => {
    const metrics = {
      todaySunsetMinutes: 1000,
      weekSunsetMinutes: 990,
      monthSunsetMinutes: 980,
      todayDaylight: 600,
      weekDaylight: 590,
      monthDaylight: 580,
      yearlyExtremes: {
        earliestSunsetMinutes: 900,
        shortestDayMinutes: 500,
        longestDayMinutes: 700,
      },
    };
    const deltas = calculateDeltas(metrics);
    expect(deltas.comparisonMode).toBe("month");
    expect(deltas.sunsetComparisonDelta).toBe(20);
    expect(deltas.daylightComparisonDelta).toBe(20);
  });

  it("falls back to week comparison when month is negative", () => {
    const metrics = {
      todaySunsetMinutes: 600,
      weekSunsetMinutes: 590,
      monthSunsetMinutes: 650,
      todayDaylight: 600,
      weekDaylight: 590,
      monthDaylight: 610,
      yearlyExtremes: {
        earliestSunsetMinutes: 500,
        shortestDayMinutes: 400,
        longestDayMinutes: 800,
      },
    };
    const deltas = calculateDeltas(metrics);
    expect(deltas.comparisonMode).toBe("week");
    expect(deltas.sunsetComparisonDelta).toBe(10);
  });

  it("disables comparison when both month and week are negative", () => {
    const metrics = {
      todaySunsetMinutes: 500,
      weekSunsetMinutes: 520,
      monthSunsetMinutes: 540,
      todayDaylight: 500,
      weekDaylight: 520,
      monthDaylight: 540,
      yearlyExtremes: {
        earliestSunsetMinutes: 480,
        shortestDayMinutes: 400,
        longestDayMinutes: 800,
      },
    };
    const deltas = calculateDeltas(metrics);
    expect(deltas.comparisonMode).toBe("none");
    expect(deltas.sunsetComparisonDelta).toBe(-40);
  });

  it("calculates fraction of loss completed", () => {
    const metrics = {
      todaySunsetMinutes: 600,
      weekSunsetMinutes: 590,
      monthSunsetMinutes: 580,
      todayDaylight: 600,
      weekDaylight: 590,
      monthDaylight: 580,
      yearlyExtremes: {
        earliestSunsetMinutes: 500,
        shortestDayMinutes: 400,
        longestDayMinutes: 800,
      },
    };
    const deltas = calculateDeltas(metrics);
    expect(deltas.fractionOfLossCompleted).toBeCloseTo(0.5, 5);
  });

  it("shows 24 hours of daylight during polar day", () => {
    const dom = buildStatsDom();
    const metrics = buildStatsMetrics();
    updateStatsUI(dom, metrics, baseDeltas, "UTC", stubFormatters, "polar-day");
    expect(dom.daylightDurationValue.textContent).toBe("24 hours");
  });

  it("shows 0 hours of daylight during polar night", () => {
    const dom = buildStatsDom();
    const metrics = buildStatsMetrics();
    updateStatsUI(dom, metrics, baseDeltas, "UTC", stubFormatters, "polar-night");
    expect(dom.daylightDurationValue.textContent).toBe("0 hours");
  });

  it("adds the first sunrise milestone during polar night", () => {
    const astronomy = buildAstronomyStub({
      sunriseDateParts: { year: 2026, month: 1, day: 15 },
    });
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: null,
        longestDayDateParts: null,
      },
    };
    const { upcoming } = buildUpcomingMilestones(
      astronomy,
      { year: 2026, month: 1, day: 1 },
      metrics,
      "north",
      "UTC",
      () => "",
      "polar-night"
    );
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe("first-sunrise");
  });

  it("adds the first sunset milestone during polar day", () => {
    const astronomy = buildAstronomyStub({
      sunsetDateParts: { year: 2026, month: 7, day: 20 },
    });
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: null,
        longestDayDateParts: null,
      },
    };
    const { upcoming } = buildUpcomingMilestones(
      astronomy,
      { year: 2026, month: 7, day: 1 },
      metrics,
      "north",
      "UTC",
      () => "",
      "polar-day"
    );
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe("first-sunset");
  });
});
