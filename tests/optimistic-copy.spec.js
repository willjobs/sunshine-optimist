import { test, expect } from "@playwright/test";
import { BOSTON } from "./helpers/fixtures.js";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
  setStoredLocation,
} from "./helpers/mock-network.js";

const SYDNEY = {
  ...BOSTON,
  name: "Sydney",
  admin1: "New South Wales",
  country: "Australia",
  country_code: "AU",
  latitude: -33.87,
  longitude: 151.21,
  timezone: "Australia/Sydney",
};
const LONGYEARBYEN = {
  ...BOSTON,
  name: "Longyearbyen",
  country: "Norway",
  country_code: "NO",
  latitude: 78.2232,
  longitude: 15.6469,
  timezone: "Arctic/Longyearbyen",
};

const load = async (page, date, location = BOSTON) => {
  await installFontMocks(page);
  await installApiMocks(page);
  await installPermissionsMock(page, "denied");
  await setStoredLocation(page, location);
  await page.goto("/");
  await expect(page.locator("#headline")).not.toHaveAttribute("data-loading", "true", {
    timeout: 15000,
  });
  await page.locator("#date-input").fill(date);
  await page.locator("#date-input").press("Enter");
  await expect
    .poll(
      async () => {
        const data = (await debug(page)).data;
        return data?.today_date ? data.today_date.toISOString().slice(0, 10) : null;
      },
      { timeout: 15000 }
    )
    .toBe(date);
  await expect(page.locator("#next-headline")).not.toBeEmpty();
  await expect(page.locator("#date-input")).toHaveValue(date);
};
const debug = (page) => page.evaluate(() => window.SunshineOptimistDebug.getOptimisticMessages());
const show = async (page, id) => {
  const index = await page.evaluate(async (messageId) => {
    const { getOptimisticOptions } = await import("/scripts/state/app-state.js");
    return getOptimisticOptions().findIndex((message) => message.id === messageId);
  }, id);
  expect(index, `${id} must be in the rendered rotation`).toBeGreaterThanOrEqual(0);
  const copy = (await debug(page)).validOptions.find((message) => message.id === id);
  await page.locator("#optimistic-dots button").nth(index).click();
  await expect(page.locator("#headline")).toHaveText(copy.headline);
  return copy;
};
const shareText = async (page) => {
  await page.getByRole("button", { name: /Share Your Sunlight/i }).click();
  await page.locator("[data-share-mode='text']").click();
  await expect(page.locator("#share-preview")).toContainText("SunshineOptimist.com");
  return page.locator("#share-preview").textContent();
};

for (const [name, location, date] of [
  ["north", BOSTON, "2026-12-09"],
  ["south", SYDNEY, "2026-06-13"],
]) {
  test(`${name}: later sunsets are a confetti celebration on the first improving day`, async ({
    page,
  }) => {
    await load(page, date, location);
    await expect(page.locator("#headline")).toHaveText("Sunsets are getting later again!");
    await expect(page.locator("#lede")).toHaveText(/In two weeks, sunset will be .* later\./);
    await expect(page.locator("#confetti .confetti-piece")).toHaveCount(72);
    await expect(page.locator("#optimistic-dots button")).toHaveCount(0);
    expect(await shareText(page)).toContain("Sunsets are getting later again!");
  });
}

test("countdowns describe benefits, use compact cards, and propagate to sharing", async ({
  page,
}) => {
  await load(page, "2026-12-01");
  await expect(page.locator("#next-headline")).toHaveText("Later sunsets begin");
  await expect(page.locator("#next-away")).toHaveText("(8 days away)");
  await show(page, "later-sunsets-countdown");
  await expect(page.locator("#headline")).toHaveText(
    "Only 8 days until sunsets start getting later again!"
  );
  const text = await shareText(page);
  expect(text).toContain("📈 Only 8 days until sunsets start getting later again!");
  expect(text).not.toMatch(/until (the )?earliest sunset|Progress towards shortest day/);
});

test("quantifies both loss progress and slowdown", async ({ page }) => {
  await load(page, "2026-12-01");
  const data = (await debug(page)).data;
  expect(data.fraction_of_loss_completed).toBeGreaterThanOrEqual(0.75);
  expect(data.daylight_loss_slowdown_percent).toBeGreaterThanOrEqual(25);
  await show(page, "loss-behind");
  await expect(page.locator("#headline")).toHaveText(
    /You’ve made it through \d+% of the year’s daylight loss\./
  );
  await show(page, "loss-slowdown");
  await expect(page.locator("#headline")).toHaveText(
    /Daylight loss is \d+% slower than a month ago\./
  );
});

test("winter-average comparison disappears below 90 actual minutes", async ({ page }) => {
  await load(page, "2026-10-10");
  await show(page, "above-winter-average");
  const before = (await debug(page)).data;
  expect(before.daylight_today - before.average_winter_daylight).toBeGreaterThanOrEqual(90);
  await page.locator("#date-input").fill("2026-10-15");
  await page.locator("#date-input").press("Enter");
  await expect
    .poll(async () => (await debug(page)).data.today_date.toISOString().slice(0, 10))
    .toBe("2026-10-15");
  const after = await debug(page);
  expect(after.data.daylight_today - after.data.average_winter_daylight).toBeLessThan(90);
  expect(after.validOptions.some((message) => message.id === "above-winter-average")).toBe(false);
});

test("acceleration is displayed before spring, and the weekly wording takes over afterward", async ({
  page,
}) => {
  await load(page, "2026-02-10");
  await show(page, "accelerating");
  const winter = (await debug(page)).data;
  expect(winter.before_spring_equinox).toBe(1);
  expect(winter.gains_are_accelerating).toBe(1);
  await page.locator("#date-input").fill("2026-04-10");
  await page.locator("#date-input").press("Enter");
  await expect.poll(async () => (await debug(page)).month).toBe(4);
  await show(page, "weekly-gain");
  await expect(page.locator("#headline")).toHaveText(
    /You've gained .* of daylight over the past week!/
  );
});

test("longer-day celebration and rear-view message use the actual shortest day", async ({
  page,
}) => {
  await load(page, "2026-12-22");
  await expect(page.locator("#headline")).toHaveText("Days start getting longer today.");
  await expect(page.locator("#lede")).toHaveText(/In two weeks, you'll have .* more daylight\./);
  await page.locator("#date-input").fill("2026-12-27");
  await page.locator("#date-input").press("Enter");
  await expect.poll(async () => (await debug(page)).data.days_since_shortest_day).toBe(6);
  await show(page, "rear-view");
  await expect(page.locator("#headline")).toHaveText(
    "The shortest day is in your rear-view mirror (6 days ago)."
  );
});

test("long summer days and the longest-day celebration stay positive", async ({ page }) => {
  await load(page, "2026-06-10");
  await show(page, "near-longest");
  await show(page, "brightest-weeks");
  await page.locator("#date-input").fill("2026-06-21");
  await page.locator("#date-input").press("Enter");
  await expect(page.locator("#headline")).toHaveText(/Enjoy .* of daylight today!/);
  await expect(page.locator("#headline")).not.toHaveText(/most this year|maximum|shorter/i);
});

test("milestone cycling keeps every compact title inside the card", async ({ page }) => {
  await load(page, "2026-12-01");
  const titles = await page.evaluate(async () =>
    (await import("/scripts/state/app-state.js")).getUpcomingMilestones().map((item) => item.title)
  );
  expect(titles).toEqual(
    expect.arrayContaining([
      "Later sunsets begin",
      "Longer days begin",
      "Earlier sunrises begin",
      "30m daylight gained",
      "1h 30m daylight gained",
      "10+ hours of daylight",
      "12+ hours of daylight",
      "10 darkest weeks behind you",
      "Spring begins",
      "Daylight saving time starts",
      "Longest day of the year",
    ])
  );
  for (const title of titles) {
    await expect(page.locator("#next-headline")).toHaveText(title);
    const fits = await page
      .locator("#next-headline")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits, title).toBe(true);
    await page.locator("#milestone-toggle").click();
  }
});

test("a polar sunset stays informational in the card and in sharing", async ({ page }) => {
  await load(page, "2026-07-01", LONGYEARBYEN);
  const result = await page.evaluate(async () => {
    const state = await import("/scripts/state/app-state.js");
    return state.getUpcomingMilestones().find((item) => item.id === "first-sunset");
  });
  expect(result.informationalOnly).toBe(true);
  // Select the informational card through its actual arrow control.
  const count = await page.evaluate(
    async () => (await import("/scripts/state/app-state.js")).getUpcomingMilestones().length
  );
  for (
    let i = 0;
    i < count && (await page.locator("#next-headline").textContent()) !== result.title;
    i += 1
  )
    await page.locator("#milestone-toggle").click();
  await expect(page.locator("#next-headline")).toHaveText("First sunset after midnight sun");
  expect(await shareText(page)).not.toMatch(/📈.*sunset after midnight sun/);
  await page.getByRole("button", { name: "Close share dialog" }).click();
  const date = `${result.dateParts.year}-${String(result.dateParts.month).padStart(2, "0")}-${String(result.dateParts.day).padStart(2, "0")}`;
  await page.locator("#date-input").fill(date);
  await page.locator("#date-input").press("Enter");
  await expect
    .poll(async () => (await debug(page)).data.today_date.toISOString().slice(0, 10))
    .toBe(date);
  await expect(page.locator("#headline")).not.toHaveText(/first sunset|Night is returning/i);
  await expect(page.locator("#confetti .confetti-piece")).toHaveCount(0);
});

test("rapid date changes finish with the last selected day's copy", async ({ page }) => {
  await load(page, "2026-12-01");
  for (const date of ["2026-02-10", "2026-06-21", "2026-12-09"]) {
    await page.locator("#date-input").fill(date);
    await page.locator("#date-input").press("Enter");
  }
  await expect(page.locator("#headline")).toHaveText("Sunsets are getting later again!");
  await expect
    .poll(async () => (await debug(page)).data.today_date.toISOString().slice(0, 10))
    .toBe("2026-12-09");
  await expect(page.locator("#date-input")).toHaveValue("2026-12-09");
});

test("a dynamic half-hour sunset celebrates on its crossing day", async ({ page }) => {
  await load(page, "2026-04-19");
  await expect(page.locator("#headline")).toHaveText("Sunset is now after 7:30 PM!");
  await expect(page.locator("#confetti .confetti-piece")).toHaveCount(72);
});

test("a one-event polar transition describes the missing pair accurately", async ({ page }) => {
  const alert = {
    ...BOSTON,
    name: "Alert",
    country: "Canada",
    country_code: "CA",
    latitude: 82.5018,
    longitude: -62.3481,
    timezone: "America/Iqaluit",
  };
  await load(page, "2026-09-05", alert);
  await expect(page.locator("#share")).toBeEnabled();
  await expect(page.locator("#sunset-time")).not.toHaveText("—");
  await expect(page.locator("#lede")).toHaveText("Sunrise and sunset don’t both occur today.");
});

test("Boston celebrates how little earlier sunset can move, then switches to the turnaround", async ({
  page,
}) => {
  await load(page, "2026-11-10");
  const copy = await show(page, "evening-light-left");
  expect(copy.headline).toBe("Only 16 minutes of evening light left to lose.");
  await expect(page.locator("#lede")).toHaveText("Then sunsets start getting later again.");
  const text = await shareText(page);
  expect(text).toContain(copy.headline);
  await page.getByRole("button", { name: "Close share dialog" }).click();
  await page.locator("#date-input").fill("2026-12-09");
  await page.locator("#date-input").press("Enter");
  await expect(page.locator("#headline")).toHaveText("Sunsets are getting later again!");
});
