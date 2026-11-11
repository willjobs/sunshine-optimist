import { beforeAll, describe, it, expect } from "vitest";
import { createAstronomyContext } from "../utils/astronomy-utils.js";
import { addDaysToDateParts, compareDateParts } from "../utils/date-utils.js";
import { getSeasonalContextAsync } from "../services/seasonal-insights-service.js";
import {
  calculateSunMetrics,
  calculateDeltas,
  buildMessageData,
  buildUpcomingMilestones,
} from "./daylight-controller.js";
import { getOptimisticMessageOptions } from "../messages.js";

beforeAll(async () => {
  const module = await import("../../astronomy-engine/astronomy.browser.js");
  if (!globalThis.Astronomy && module?.default) globalThis.Astronomy = module.default;
});

const location = { latitude: 42.3601, longitude: -71.0589 };
const build = async (
  today,
  loc = location,
  hemisphere = "north",
  timezone = "America/New_York"
) => {
  const astronomy = createAstronomyContext(loc, timezone);
  const metrics = await calculateSunMetrics(astronomy, today);
  const seasonal = await getSeasonalContextAsync(astronomy, today, hemisphere);
  const data = (
    await buildMessageData(
      astronomy,
      today,
      metrics,
      calculateDeltas(metrics),
      hemisphere,
      timezone,
      () => "",
      seasonal
    )
  ).messageData;
  const milestones = buildUpcomingMilestones(
    astronomy,
    today,
    metrics,
    hemisphere,
    timezone,
    (x) => String(x),
    "normal",
    new Map(),
    null,
    metrics.yearlyExtremes.maxDailyGainDateParts,
    seasonal
  );
  return { astronomy, metrics, seasonal, data, ...milestones };
};

describe("messages and milestones share real seasonal calculations", () => {
  it("celebrates the improving day and keeps a positive numeric outlook", async () => {
    const before = await build({ year: 2026, month: 12, day: 8 });
    expect(before.todayMilestone?.id).not.toBe("earliest-sunset");
    const on = await build({ year: 2026, month: 12, day: 9 });
    expect(on.todayMilestone.id).toBe("earliest-sunset");
    expect(on.todayMilestone.todayHeadline).toBe("Sunsets are getting later again!");
    expect(on.todayMilestone.todayLede).toMatch(/In two weeks, sunset will be \d+ minutes later/);
  });
  it("finds a sunset threshold crossed before the winter solstice", async () => {
    const loc = { ...location, longitude: -75.5 };
    const result = await build({ year: 2026, month: 12, day: 1 }, loc);
    const threshold = result.upcoming.find((milestone) => milestone.id === "sunset-after-430");
    expect(threshold).toBeDefined();
    expect(compareDateParts(threshold.dateParts, { year: 2026, month: 12, day: 21 })).toBe(-1);
    expect(
      result.astronomy.getSunsetMinutesForDateParts(threshold.dateParts)
    ).toBeGreaterThanOrEqual(990);
    expect(
      result.astronomy.getSunsetMinutesForDateParts(addDaysToDateParts(threshold.dateParts, -1))
    ).toBeLessThan(990);
  });
  it("uses the shortest-day baseline for all four daylight gain milestones", async () => {
    const result = await build({ year: 2026, month: 12, day: 22 });
    const season = result.seasonal.pastDaylight;
    for (const minutes of [30, 60, 90, 120]) {
      const milestone = result.upcoming.find((item) => item.id === `gain-${minutes}`);
      const gain =
        result.astronomy.getDaylightMinutesForDateParts(milestone.dateParts) -
        season.shortestDayMinutes;
      const previousGain =
        result.astronomy.getDaylightMinutesForDateParts(
          addDaysToDateParts(milestone.dateParts, -1)
        ) - season.shortestDayMinutes;
      expect(gain).toBeGreaterThanOrEqual(minutes);
      expect(previousGain).toBeLessThan(minutes);
      expect(milestone.todayHeadline).toContain("since the shortest day");
    }
  });
  it("keeps the sunrise/DST copy and gives a shared-day turnaround priority", async () => {
    const result = await build({ year: 2026, month: 12, day: 9 });
    const withSunrise = buildUpcomingMilestones(
      result.astronomy,
      { year: 2026, month: 12, day: 9 },
      result.metrics,
      "north",
      "America/New_York",
      () => "",
      "normal",
      new Map(),
      { year: 2026, month: 12, day: 9 },
      null,
      result.seasonal
    );
    expect(withSunrise.todayMilestone.id).toBe("earliest-sunset");
    const dst = result.upcoming.find((item) => item.id === "dst-start");
    expect(dst.title).toBe("Daylight saving time starts");
    expect(dst.todayHeadline).toBe("Daylight Saving Time starts today.");
    expect(dst.todayLede).toBe("Don't forget to spring forward.");
  });
  it("celebrates a crossed dynamic half-hour target instead of skipping it", async () => {
    const result = await build({ year: 2026, month: 4, day: 8 });
    const season = result.seasonal.pastSunset;
    const crossing = result.astronomy.findFirstSunsetAfter(season.earliestSunsetDateParts, 1170);
    const on = await build(crossing.dateParts);
    expect(on.todayMilestone?.id).toBe("next-sunset-1170");
    expect(on.todayMilestone.todayHeadline).toBe("Sunset is now after 1170!");
    expect(on.upcoming.some((item) => item.id === "next-sunset-1170")).toBe(false);
  });
  it("does not celebrate a fake longest day when midnight sun ends", async () => {
    const loc = { latitude: 78.2232, longitude: 15.6469 };
    const result = await build(
      { year: 2026, month: 8, day: 25 },
      loc,
      "north",
      "Arctic/Longyearbyen"
    );
    expect(result.todayMilestone).toBeUndefined();
    expect(result.upcoming.find((item) => item.id === "first-sunset")?.informationalOnly).toBe(
      true
    );
  });
  it("sets valid lengthening and equinox flags across southern winter", async () => {
    const result = await build(
      { year: 2026, month: 8, day: 10 },
      { latitude: -33.87, longitude: 151.21 },
      "south",
      "Australia/Sydney"
    );
    expect(result.data.after_winter_solstice).toBe(1);
    expect(result.data.before_spring_equinox).toBe(1);
    expect(result.data.days_are_lengthening).toBe(1);
    const options = getOptimisticMessageOptions(result.data, 8, "south");
    expect(options.find((message) => message.id === "accelerating")).toBeDefined();
  });
});
