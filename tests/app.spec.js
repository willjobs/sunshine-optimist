// @ts-check
import { test, expect } from "@playwright/test";
import { BOSTON } from "./helpers/fixtures.js";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
  setStoredLocation,
} from "./helpers/mock-network.js";

test.beforeEach(async ({ page }) => {
  await installFontMocks(page);
  await installApiMocks(page);
  await installPermissionsMock(page, "denied");
  await setStoredLocation(page, BOSTON);
});

test("app loads with baseline content and stats", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Sunshine Optimist");
  await expect(page.getByText("Sunshine Optimist")).toBeVisible();

  const cityInput = page.getByRole("combobox", { name: "City" });
  await expect(cityInput).toBeVisible();
  await expect(cityInput).toHaveAttribute("placeholder", "Enter your city");
  await expect(page.locator("#date-input")).toBeVisible();
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Share Your Sunlight/i })).toBeVisible();

  await expect(page.locator("#headline")).toHaveText(/.+/);
  await expect(page.locator("#lede")).toHaveText(/.+/);
  await expect(page.locator("#sunset-time")).not.toHaveText("—");
  await expect(page.locator("#daylight-duration")).not.toHaveText("—");
  await expect(page.locator("#next-headline")).toHaveText(/.+/);

  const hasDebugApi = await page.evaluate(
    () => typeof window.SunshineOptimistDebug?.getOptimisticMessages === "function"
  );
  expect(hasDebugApi).toBe(true);
});
