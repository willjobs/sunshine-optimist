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

test("milestone toggle cycles upcoming milestones", async ({ page }) => {
  await page.goto("/");

  const toggle = page.locator("#milestone-toggle");
  await expect(toggle).toBeEnabled();

  const initialLabel = await toggle.getAttribute("aria-label");
  const initialHeadline = await page.locator("#next-headline").textContent();

  await toggle.click();

  await expect(toggle).not.toHaveAttribute("aria-label", initialLabel || "");
  await expect(page.locator("#next-headline")).not.toHaveText(initialHeadline || "");
});

test("explore action is visible with a selected city and opens results in place", async ({
  page,
}) => {
  await page.goto("/");

  const explore = page.locator("#milestone-explorer-toggle");
  const panel = page.locator("#milestone-explorer-panel");
  const city = page.getByRole("combobox", { name: "City" });

  await expect(explore).toBeVisible();
  await expect(explore).toHaveText("Explore milestones in other cities");
  await expect(explore).toHaveAttribute("aria-expanded", "false");
  await explore.click();

  await expect(explore).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(city).toHaveValue("Boston, MA");
  await expect(page.locator("#milestone-explorer-status")).toHaveText(
    /with a milestone found|no milestones found/i
  );

  await explore.click();
  await expect(panel).toBeHidden();
  await expect(explore).toHaveAttribute("aria-expanded", "false");
});

test("choosing an explored milestone city updates the active city", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
  await page.goto("/");

  const city = page.getByRole("combobox", { name: "City" });
  await page.locator("#milestone-explorer-toggle").click();
  const firstResult = page.locator("#milestone-explorer-results button").first();
  await expect(firstResult).toBeVisible({ timeout: 30000 });
  const resultCity = await firstResult.locator(".milestone-explorer-city-name").textContent();

  await firstResult.click();

  await expect(city).toHaveValue(resultCity || "");
  await expect(page.locator("#milestone-explorer-panel")).toBeHidden();
});

test("delta tooltip opens with keyboard and closes on escape", async ({ page }) => {
  await page.goto("/");

  const tooltipTarget = page.locator("#sunset-earliest-reference");
  await expect(tooltipTarget).toHaveAttribute("data-tooltip", /.+/);

  await tooltipTarget.focus();
  await page.keyboard.press("Enter");
  await expect(tooltipTarget).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(tooltipTarget).toHaveAttribute("aria-expanded", "false");
});
