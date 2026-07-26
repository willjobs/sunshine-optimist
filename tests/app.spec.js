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
  await expect(page.getByText("Sunshine Optimist", { exact: true })).toBeVisible();

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

test("message navigation uses keyboard-operable button semantics", async ({ page }) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Message navigation" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);

  const messageButtons = navigation.getByRole("button");
  const buttonCount = await messageButtons.count();
  expect(buttonCount).toBeGreaterThan(1);
  await expect(messageButtons.first()).toHaveAttribute("aria-current", "true");

  const lastButton = messageButtons.last();
  await lastButton.focus();
  await page.keyboard.press("Enter");

  await expect(lastButton).toHaveAttribute("aria-current", "true");
  await expect(messageButtons.first()).not.toHaveAttribute("aria-current");
});
