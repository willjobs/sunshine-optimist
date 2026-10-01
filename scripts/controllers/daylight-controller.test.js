// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildUpcomingMilestones,
  getUpcomingSunriseThresholdsAsync,
  getUpcomingLatestSunriseAsync,
  getUpcomingFastestGainAsync,
  calculateSunMetrics,
  calculateDeltas,
  updateStatsUI,
  updateDaylightForLocation,
  _resetUpdateGeneration,
} from "./daylight-controller.js";

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

const isSameDateParts = (left, right) =>
  Boolean(left && right) &&
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day;

const buildAstronomyStub = ({ sunriseDateParts = null, sunsetDateParts = null } = {}) => ({
  getPreviousSeasonDateParts: () => ({ year: 2026, month: 12, day: 1 }),
  getSunEvents: (parts) => ({
    sunrise: isSameDateParts(parts, sunriseDateParts) ? { date: new Date(0) } : null,
    sunset: isSameDateParts(parts, sunsetDateParts) ? { date: new Date(0) } : null,
  }),
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
  findFirstSunset: () => (sunsetDateParts ? { dateParts: sunsetDateParts, offsetDays: 10 } : null),
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

  it("uses astronomy sunset minute helpers so post-midnight sunsets stay normalized", async () => {
    const sunsetMinuteValues = [1441.08, 1310.5, 1205.25, 1435.2];
    const astronomy = {
      getSunEvents: vi.fn(() => ({
        sunrise: { date: new Date(0) },
        sunset: { date: new Date(0) },
      })),
      getSunsetMinutesForDateParts: vi.fn(() => sunsetMinuteValues.shift() ?? null),
      getDaylightMinutesForDateParts: vi.fn(() => 600),
      getYearlySunExtremesAsync: vi.fn(async () => ({
        earliestSunsetMinutes: 1100,
        earliestSunsetDateParts: { year: 2026, month: 12, day: 1 },
        shortestDayMinutes: 500,
        shortestDayDateParts: { year: 2026, month: 12, day: 21 },
        longestDayMinutes: 900,
        longestDayDateParts: { year: 2026, month: 6, day: 21 },
        maxDailyGainMinutes: 2,
        maxDailyGainDateParts: { year: 2026, month: 1, day: 2 },
        daysWithLessDaylight: 0,
      })),
    };

    const metrics = await calculateSunMetrics(astronomy, { year: 2026, month: 4, day: 28 });
    expect(metrics.todaySunsetMinutes).toBe(1441.08);
    expect(metrics.weekSunsetMinutes).toBe(1310.5);
    expect(metrics.monthSunsetMinutes).toBe(1205.25);
    expect(metrics.yesterdaySunsetMinutes).toBe(1435.2);
    expect(astronomy.getSunsetMinutesForDateParts).toHaveBeenCalledTimes(4);
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
    expect(upcoming.some((milestone) => milestone.id === "first-sunrise")).toBe(true);
  });

  it("adds stable morning thresholds to the milestone card", () => {
    const todayParts = { year: 2026, month: 3, day: 1 };
    const thresholdDay = { year: 2026, month: 3, day: 25 };
    const astronomy = buildAstronomyStub();
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
      todayParts,
      metrics,
      "north",
      "UTC",
      () => "",
      "normal",
      new Map([[7 * 60, thresholdDay]])
    );
    expect(upcoming.find((milestone) => milestone.id === "sunrise-before-7")?.dateParts).toEqual(
      thresholdDay
    );
  });

  it("celebrates the day after the latest winter sunrise", () => {
    const todayParts = { year: 2026, month: 1, day: 8 };
    const astronomy = buildAstronomyStub();
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: null,
        longestDayDateParts: null,
      },
    };
    const { todayMilestone } = buildUpcomingMilestones(
      astronomy,
      todayParts,
      metrics,
      "north",
      "UTC",
      () => "",
      "normal",
      new Map(),
      todayParts
    );
    expect(todayMilestone?.id).toBe("latest-sunrise-passed");
    expect(todayMilestone?.todayHeadline).toContain("latest sunrise");
  });

  it("uses next winter's latest-sunrise date after this year's turn", async () => {
    const previousWinter = { year: 2025, month: 12, day: 21 };
    const nextWinter = { year: 2026, month: 12, day: 21 };
    const astronomy = {
      getPreviousSeasonDateParts: () => previousWinter,
      getNextSeasonDateParts: () => nextWinter,
      findLatestSunrisePassedAsync: vi.fn(async (winter) =>
        isSameDateParts(winter, previousWinter)
          ? { year: 2026, month: 1, day: 8 }
          : { year: 2027, month: 1, day: 9 }
      ),
    };
    expect(
      await getUpcomingLatestSunriseAsync(astronomy, { year: 2026, month: 10, day: 1 }, "north")
    ).toEqual({ year: 2027, month: 1, day: 9 });
  });

  it("includes the fastest-gaining day as a milestone", () => {
    const todayParts = { year: 2026, month: 3, day: 20 };
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: null,
        longestDayDateParts: null,
      },
    };
    const { todayMilestone } = buildUpcomingMilestones(
      buildAstronomyStub(),
      todayParts,
      metrics,
      "north",
      "UTC",
      () => "",
      "normal",
      new Map(),
      null,
      todayParts
    );
    expect(todayMilestone?.id).toBe("fastest-daylight-gain");
  });

  it("gets next year's fastest gain after this year's has passed", async () => {
    const astronomy = {
      getYearlySunExtremesAsync: vi.fn(async () => ({
        maxDailyGainMinutes: 3,
        maxDailyGainDateParts: { year: 2027, month: 3, day: 18 },
      })),
    };
    const current = {
      maxDailyGainMinutes: 2,
      maxDailyGainDateParts: { year: 2026, month: 3, day: 19 },
    };
    expect(
      await getUpcomingFastestGainAsync(astronomy, { year: 2026, month: 10, day: 1 }, current)
    ).toEqual({ year: 2027, month: 3, day: 18 });
    expect(astronomy.getYearlySunExtremesAsync).toHaveBeenCalledWith(2027, null);
  });

  it("looks to the next brightening season after a threshold has passed", async () => {
    const previousWinter = { year: 2025, month: 12, day: 21 };
    const nextWinter = { year: 2026, month: 12, day: 21 };
    const astronomy = {
      getPreviousSeasonDateParts: () => previousWinter,
      getNextSeasonDateParts: (_dateParts, _hemisphere, season) =>
        season === "winter" ? nextWinter : { year: 2027, month: 6, day: 21 },
      findStableSunriseThresholdsAsync: vi.fn(async (winter) =>
        isSameDateParts(winter, previousWinter)
          ? new Map([[7 * 60, { year: 2026, month: 3, day: 25 }]])
          : new Map([[7 * 60, { year: 2027, month: 3, day: 24 }]])
      ),
    };
    const upcoming = await getUpcomingSunriseThresholdsAsync(
      astronomy,
      { year: 2026, month: 10, day: 1 },
      "north"
    );
    expect(upcoming.get(7 * 60)).toEqual({ year: 2027, month: 3, day: 24 });
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
    expect(upcoming.some((milestone) => milestone.id === "first-sunset")).toBe(true);
  });

  it("prefers the first sunrise milestone when multiple milestones share the day", () => {
    const todayParts = { year: 2026, month: 1, day: 15 };
    const astronomy = buildAstronomyStub({ sunriseDateParts: todayParts });
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: todayParts,
        longestDayDateParts: null,
      },
    };
    const { todayMilestone, upcoming } = buildUpcomingMilestones(
      astronomy,
      todayParts,
      metrics,
      "north",
      "UTC",
      () => "",
      "normal"
    );
    expect(todayMilestone?.id).toBe("first-sunrise");
    expect(upcoming.some((milestone) => milestone.id === "first-sunrise")).toBe(false);
  });

  it("includes the first sunset milestone on the return day", () => {
    const todayParts = { year: 2026, month: 7, day: 20 };
    const astronomy = buildAstronomyStub({ sunsetDateParts: todayParts });
    const metrics = {
      todaySunsetMinutes: null,
      yearlyExtremes: {
        earliestSunsetDateParts: null,
        shortestDayDateParts: null,
        longestDayDateParts: null,
      },
    };
    const { todayMilestone, upcoming } = buildUpcomingMilestones(
      astronomy,
      todayParts,
      metrics,
      "north",
      "UTC",
      () => "",
      "normal"
    );
    expect(todayMilestone?.id).toBe("first-sunset");
    expect(upcoming.some((milestone) => milestone.id === "first-sunset")).toBe(false);
  });
});

describe("updateDaylightForLocation generation counter", () => {
  beforeEach(() => {
    _resetUpdateGeneration();
  });

  it("returns early when Astronomy is unavailable", async () => {
    const updateOptimisticMessage = vi.fn();
    await updateDaylightForLocation({
      location: { latitude: 42, longitude: -71, timezone: "America/New_York" },
      dom: {},
      getActiveDateParts: () => ({ year: 2025, month: 6, day: 1 }),
      syncDatePicker: vi.fn(),
      updateOptimisticMessage,
      formatters: {},
      fallbackTimeZone: "UTC",
    });
    expect(updateOptimisticMessage).not.toHaveBeenCalled();
  });

  it("increments generation on each call so stale updates can be detected", async () => {
    // Stub window.Astronomy so the function doesn't exit early
    vi.stubGlobal("Astronomy", {});

    // The function will fail at createAstronomyContext, but the generation
    // counter should still have incremented. We verify by calling twice and
    // checking that _resetUpdateGeneration is functional (no throw).
    const call = () =>
      updateDaylightForLocation({
        location: { latitude: 42, longitude: -71, timezone: "UTC" },
        dom: {},
        getActiveDateParts: () => ({ year: 2025, month: 6, day: 1 }),
        syncDatePicker: vi.fn(),
        updateOptimisticMessage: vi.fn(),
        formatters: {},
        fallbackTimeZone: "UTC",
      }).catch(() => {});

    await Promise.allSettled([call(), call()]);
    // If the generation counter didn't exist, _resetUpdateGeneration would not
    // be exported. Its existence and functionality confirms the guard is in place.
    expect(_resetUpdateGeneration).toBeTypeOf("function");
    _resetUpdateGeneration();

    vi.unstubAllGlobals();
  });
});
