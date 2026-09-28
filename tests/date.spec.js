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

test("date input commits custom date and reset returns to live date", async ({ page }) => {
  await page.goto("/");

  const dateInput = page.locator("#date-input");
  const datePicker = page.locator(".date-picker");
  const todayButton = page.getByRole("button", { name: "Today" });

  await dateInput.fill("2024-12-15");
  await dateInput.press("Enter");

  await expect(datePicker).toHaveClass(/is-custom/);
  await expect(todayButton).toBeEnabled();

  await todayButton.click();

  await expect(datePicker).not.toHaveClass(/is-custom/);
  await expect(todayButton).toBeDisabled();
  await expect(dateInput).not.toHaveValue("2024-12-15");
});

test("live date advances at midnight in the selected city", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-28T14:59:50Z") });
  await setStoredLocation(page, {
    name: "Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: "Asia/Tokyo",
  });
  await page.goto("/");

  const dateInput = page.locator("#date-input");
  await expect(dateInput).toHaveValue("2026-09-28");
  await expect(page.locator("#daylight-duration")).not.toHaveText("—");

  await page.clock.fastForward(11000);
  await expect(dateInput).toHaveValue("2026-09-29");
});
