// @ts-check
import { expect, test } from "@playwright/test";

const BOSTON = {
  name: "Boston",
  admin1: "Massachusetts",
  admin2: "",
  country: "United States",
  country_code: "US",
  latitude: 42.3601,
  longitude: -71.0589,
  elevation: 0,
  timezone: "America/New_York",
};

test("a freshly installed app reloads from Cache Storage while offline", async ({
  page,
  context,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript((location) => {
    window.localStorage.setItem("sunshine-optimist:active-location", JSON.stringify(location));
  }, BOSTON);

  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "City" })).toHaveValue("Boston, MA");

  await expect
    .poll(() =>
      page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        return Boolean(navigator.serviceWorker.controller);
      })
    )
    .toBe(true);

  const cacheAudit = await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find((name) =>
      name.startsWith("sunshine-optimist-static-")
    );
    if (!cacheName) {
      return { cacheName: null, missing: ["static cache"] };
    }
    const cache = await caches.open(cacheName);
    const required = [
      "/index.html",
      "/scripts/app.js",
      "/scripts/services/fetch-service.js",
      "/scripts/services/milestone-scanner-service.js",
      "/scripts/services/timezone-service.js",
      "/scripts/data/major-cities.js",
    ];
    const results = await Promise.all(
      required.map(async (asset) => [asset, Boolean(await cache.match(asset))])
    );
    return {
      cacheName,
      missing: results.filter(([, cached]) => !cached).map(([asset]) => asset),
    };
  });
  expect(cacheAudit.cacheName).toMatch(/^sunshine-optimist-static-/);
  expect(cacheAudit.missing).toEqual([]);

  const browserSession = await context.newCDPSession(page);
  await browserSession.send("Network.clearBrowserCache");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("combobox", { name: "City" })).toHaveValue("Boston, MA");
  await expect(page.locator("#headline")).not.toHaveAttribute("data-loading", "true");
  await expect(page.locator("#daylight-duration")).not.toHaveText("—");
  expect(pageErrors).toEqual([]);
});
