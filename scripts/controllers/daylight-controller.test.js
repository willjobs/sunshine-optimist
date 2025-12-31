import { describe, it, expect } from "vitest";
import { calculateDeltas } from "./daylight-controller.js";

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
});
