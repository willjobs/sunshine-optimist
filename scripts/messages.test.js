import { describe, it, expect } from "vitest";
import { OPTIMISTIC_MESSAGES, getOptimisticMessageOptions } from "./messages.js";

const options = (data, month = 2, hemisphere = "north", milestones = []) =>
  getOptimisticMessageOptions(data, month, hemisphere, milestones);
const find = (id, data, month = 2, hemisphere = "north") =>
  options(data, month, hemisphere).find((message) => message.id === id);

const minimumCases = [
  [
    "sunset-earliest",
    1,
    10,
    (x) => ({ sunset_today: 900 + x, sunset_earliest: 900, after_sunset_turnaround: 1 }),
  ],
  ["sunset-start-of-year", 2, 30, (x) => ({ sunset_today: 900 + x, sunset_start_of_year: 900 })],
  [
    "sunset-month",
    2,
    15,
    (x) => ({
      sunset_today: 900 + x,
      sunset_one_month_ago: 900,
      after_winter_solstice: 1,
      days_are_lengthening: 1,
    }),
  ],
  [
    "month-end",
    2,
    30,
    (x) => ({
      daylight_minimum: 500,
      daylight_at_end_of_month: 500 + x,
      daylight_today: 500,
      days_until_month_end: 10,
    }),
  ],
  [
    "since-shortest",
    1,
    15,
    (x) => ({ daylight_today: 500 + x, daylight_minimum: 500, days_are_lengthening: 1 }),
  ],
  ["after-5pm", 2, 30, (x) => ({ daylight_after_5pm_today: x })],
  ["daylight-month", 2, 15, (x) => ({ daylight_today: 500 + x, daylight_one_month_ago: 500 })],
  ["above-shortest", 9, 90, (x) => ({ daylight_today: 500 + x, daylight_minimum: 500 })],
  [
    "loss-behind",
    11,
    75,
    (x) => ({ fraction_of_loss_completed: x / 100, daylight_gain_today: -1 }),
  ],
  ["two-weeks", 1, 15, (x) => ({ daylight_today: 500, daylight_in_14_days: 500 + x })],
  [
    "accelerating",
    2,
    10,
    (x) => ({
      daylight_gain_this_week: x,
      before_spring_equinox: 1,
      after_winter_solstice: 1,
      gains_are_accelerating: 1,
    }),
  ],
  ["daily-gain", 2, 1, (x) => ({ daylight_gain_today: x })],
  ["weekly-gain", 2, 10, (x) => ({ daylight_gain_this_week: x })],
  [
    "loss-slowdown",
    11,
    25,
    (x) => ({ daylight_loss_slowdown_percent: x, daylight_gain_today: -1 }),
  ],
  ["late-summer-evenings", 8, 2, (x) => ({ weeks_with_sunset_after_7pm_remaining: x })],
  [
    "regained",
    2,
    25,
    (x) => ({
      daylight_today: 500 + x,
      daylight_minimum: 500,
      daylight_maximum: 600,
      days_are_lengthening: 1,
    }),
  ],
  ["daylight-percentile", 6, 60, (x) => ({ days_with_less_daylight: x, days_in_year: 100 })],
  [
    "above-winter-average",
    10,
    90,
    (x) => ({ daylight_today: 500 + x, average_winter_daylight: 500 }),
  ],
];

describe("optimistic message thresholds", () => {
  for (const [id, month, minimum, dataFor] of minimumCases) {
    it(`${id} rejects a raw value below ${minimum} even if it would round up`, () => {
      expect(find(id, dataFor(minimum - 0.4), month)).toBeUndefined();
    });
    it(`${id} accepts exactly ${minimum} and a larger value in both hemispheres`, () => {
      for (const value of [minimum, minimum + 1]) {
        expect(find(id, dataFor(value), month)).toBeDefined();
        expect(find(id, dataFor(value), ((month + 5) % 12) + 1, "south")).toBeDefined();
      }
    });
  }
  for (const [id, month, field, max] of [
    ["longer-days-countdown", 11, "days_until_longer_days", 35],
    ["later-sunsets-countdown", 11, "days_until_later_sunsets", 35],
    ["largest-increase", 2, "days_until_max_daily_gain", 42],
    ["rear-view", 12, "days_since_shortest_day", 14],
  ]) {
    it(`${id} accepts its first and last day, excludes zero and beyond the limit`, () => {
      for (const value of [1, max])
        expect(find(id, { [field]: value, days_are_lengthening: 1 }, month)).toBeDefined();
      for (const value of [0, -1, max + 1, NaN, null])
        expect(find(id, { [field]: value, days_are_lengthening: 1 }, month)).toBeUndefined();
    });
  }
  it("rejects 89.6 minutes above the winter average", () => {
    expect(
      find("above-winter-average", { daylight_today: 589.6, average_winter_daylight: 500 }, 10)
    ).toBeUndefined();
  });
  it("requires month-end to be in the future and at least 10 minutes brighter than today", () => {
    const data = {
      daylight_minimum: 500,
      daylight_today: 600,
      daylight_at_end_of_month: 610,
      days_until_month_end: 1,
    };
    expect(find("month-end", data)).toBeDefined();
    expect(find("month-end", { ...data, daylight_at_end_of_month: 609.6 })).toBeUndefined();
    expect(find("month-end", { ...data, days_until_month_end: 0 })).toBeUndefined();
  });
  it("requires the month sunset claim to be after winter and during lengthening days", () => {
    const data = minimumCases[2][3](20);
    expect(find("sunset-month", { ...data, after_winter_solstice: 0 })).toBeUndefined();
    expect(find("sunset-month", { ...data, days_are_lengthening: 0 })).toBeUndefined();
    expect(find("sunset-month", data).lede).toBe("The days are definitely getting longer!");
  });
  it("requires a meaningful seasonal range and actual lengthening for regained percentage", () => {
    const data = {
      daylight_today: 535,
      daylight_minimum: 500,
      daylight_maximum: 550,
      days_are_lengthening: 1,
    };
    expect(find("regained", data)).toBeUndefined();
    expect(
      find("regained", { ...data, daylight_maximum: 600, days_are_lengthening: 0 })
    ).toBeUndefined();
  });
  it("only describes loss progress and slowdown while days shorten", () => {
    const data = {
      fraction_of_loss_completed: 0.9,
      daylight_loss_slowdown_percent: 30,
      daylight_gain_today: 1,
    };
    expect(find("loss-behind", data, 11)).toBeUndefined();
    expect(find("loss-slowdown", data, 11)).toBeUndefined();
  });
  it("requires all acceleration checks and selects it over the identical weekly quantity", () => {
    const data = {
      daylight_gain_this_week: 20,
      daylight_gain_today: 3,
      before_spring_equinox: 1,
      after_winter_solstice: 1,
      gains_are_accelerating: 1,
    };
    expect(find("accelerating", data)).toBeDefined();
    expect(find("weekly-gain", data)).toBeUndefined();
    for (const key of [
      "before_spring_equinox",
      "after_winter_solstice",
      "gains_are_accelerating",
    ]) {
      expect(find("accelerating", { ...data, [key]: 0 })).toBeUndefined();
      expect(find("weekly-gain", { ...data, [key]: 0 })).toBeDefined();
    }
  });
  it("only shows near-longest within 30 raw minutes and before summer", () => {
    const data = { daylight_today: 870, daylight_maximum: 900, before_summer_solstice: 1 };
    expect(find("near-longest", data, 6)).toBeDefined();
    expect(find("near-longest", { ...data, daylight_today: 869.6 }, 6)).toBeUndefined();
    expect(find("near-longest", { ...data, before_summer_solstice: 0 }, 6)).toBeUndefined();
  });
  it("uses the actual brightest-day ranking flag", () => {
    expect(find("brightest-weeks", { is_in_brightest_70_days: 1 }, 6).headline).toBe(
      "You're in the 10 weeks with the most daylight of the year."
    );
    expect(find("brightest-weeks", { is_in_brightest_70_days: 0 }, 6)).toBeUndefined();
  });
  it("removes all three retired messages and the duplicate sunset turnaround rotation", () => {
    const copy = OPTIMISTIC_MESSAGES.map((m) => m.headline).join(" ");
    expect(copy).not.toMatch(
      /remain to lose|way to the shortest day|losing less than|Sunsets are getting later again!/
    );
  });
  it("keeps the unannotated daylight twin unchanged", () => {
    const data = { daylight_twin_date: "March 18" };
    expect(find("daylight-twin", data, 9).headline).toBe(
      "Today has as much daylight as March 18. They're twins!"
    );
    expect(find("daylight-twin", data, 3, "south")).toBeDefined();
    expect(find("daylight-twin", data, 7)).toBeUndefined();
  });
  it("rejects missing, null, and nonfinite input data", () => {
    for (const value of [null, undefined, Infinity, NaN, ""]) {
      expect(find("after-5pm", { daylight_after_5pm_today: value })).toBeUndefined();
    }
    expect(options({})).toEqual([]);
  });
});

describe("milestone countdowns in messages", () => {
  const milestone = {
    title: "Later sunsets begin",
    countdownTitle: "sunsets start getting later again",
    offsetDays: 5,
  };
  it("uses a complete benefit sentence, not the compact card title", () => {
    expect(options({}, 11, "north", [milestone])[0]).toMatchObject({
      headline: "Only 5 days until sunsets start getting later again!",
      lede: "You're almost there :)",
    });
  });
  it("filters informational entries first and sorts the remaining milestones", () => {
    const list = [
      { title: "First sunset after midnight sun", informationalOnly: true, offsetDays: 1 },
      { ...milestone, offsetDays: 30 },
      milestone,
    ];
    expect(options({}, 11, "north", list)[0].headline).toBe(
      "Only 5 days until sunsets start getting later again!"
    );
  });
  it("excludes invalid/past/today and distant countdowns and limits almost there to one week", () => {
    for (const days of [-1, 0, 36, Infinity, NaN])
      expect(options({}, 11, "north", [{ ...milestone, offsetDays: days }])).toEqual([]);
    expect(options({}, 11, "north", [{ ...milestone, offsetDays: 35 }])[0].headline).toContain(
      "Only 5 weeks until"
    );
    expect(options({}, 11, "north", [{ ...milestone, offsetDays: 8 }])[0].lede).not.toContain(
      "almost"
    );
  });
  it("uses the same sentence for fallback ledes and avoids self-repetition", () => {
    const data = { daylight_today: 500, daylight_in_14_days: 520 };
    const list = options(data, 12, "north", [milestone]);
    expect(list.find((m) => m.id === "two-weeks").lede).toBe(
      "Only 5 days until sunsets start getting later again!"
    );
    const dedicated = options({ days_until_later_sunsets: 5 }, 12, "north", [milestone]);
    expect(dedicated).toHaveLength(1);
    expect(dedicated[0].lede).not.toBe(dedicated[0].headline);
  });
  it("keeps group deduplication and caps the final list", () => {
    const data = {
      sunset_today: 1100,
      sunset_earliest: 900,
      sunset_start_of_year: 950,
      after_sunset_turnaround: 1,
    };
    expect(options(data).filter((m) => m.id.startsWith("sunset-"))).toHaveLength(1);
    expect(options(data).length).toBeLessThanOrEqual(10);
  });
});

describe("remaining evening light message", () => {
  it.each([0, -1, 20, 20.001, null, undefined, NaN])("does not appear for %s minutes", (gap) => {
    expect(find("evening-light-left", { sunset_minutes_left_to_lose: gap }, 11)).toBeUndefined();
  });
  it.each([
    [14, "Only 14 minutes"],
    [1, "Only 1 minute"],
    [0.001, "Less than a minute"],
    [19.99, "Only 20 minutes"],
  ])("formats %s minutes without understating the loss", (gap, phrase) => {
    const message = find("evening-light-left", { sunset_minutes_left_to_lose: gap }, 11);
    expect(message.headline).toBe(`${phrase} of evening light left to lose.`);
    expect(message.lede).toBe("Then sunsets start getting later again.");
  });
  it("uses local winter months in the southern hemisphere", () => {
    expect(
      find("evening-light-left", { sunset_minutes_left_to_lose: 14 }, 5, "south")
    ).toBeDefined();
    expect(
      find("evening-light-left", { sunset_minutes_left_to_lose: 14 }, 5, "north")
    ).toBeUndefined();
  });
});
