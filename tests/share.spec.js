// @ts-check
import { test, expect } from "@playwright/test";
import { BOSTON } from "./helpers/fixtures.js";
import {
  installApiMocks,
  installClipboardMock,
  installFontMocks,
  installPermissionsMock,
  installWindowOpenMock,
  setStoredLocation,
} from "./helpers/mock-network.js";

test.beforeEach(async ({ page }) => {
  await installFontMocks(page);
  await installApiMocks(page);
  await installPermissionsMock(page, "denied");
  await installClipboardMock(page);
  await installWindowOpenMock(page);
  await setStoredLocation(page, BOSTON);
});

test("share modal opens, previews text, and closes", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Share Your Sunlight/i }).click();

  const modal = page.locator("#share-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("#share-preview")).toHaveText(/SunshineOptimist\.com/);

  await page.getByRole("button", { name: "Close share dialog" }).click();
  await expect(modal).not.toBeVisible();
});

test("privacy toggle updates share preview and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Share Your Sunlight/i }).click();

  const privacyToggle = page.locator("#share-privacy-toggle");
  await privacyToggle.check();

  await expect(page.locator("#share-preview")).toHaveText(/My Location/);

  const storedValue = await page.evaluate(() =>
    window.localStorage.getItem("sunshine-optimist:share-privacy")
  );
  expect(storedValue).toBe("true");
});

test("copy button writes to clipboard and flashes feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Share Your Sunlight/i }).click();

  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  await copyButton.click();

  await page.waitForFunction(() => (window.__clipboardText || "").length > 0);
  const clipboardText = await page.evaluate(() => window.__clipboardText || "");
  expect(clipboardText).toContain("SunshineOptimist.com");
});

test("share links open with encoded text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Share Your Sunlight/i }).click();

  await page.getByRole("button", { name: "Share to X" }).click();

  await page.waitForFunction(() => (window.__openedUrls || []).length > 0);
  const openedUrls = await page.evaluate(() => window.__openedUrls || []);
  expect(openedUrls.length).toBeGreaterThan(0);

  const xUrl = new URL(openedUrls[0]);
  expect(xUrl.hostname).toBe("twitter.com");
  const text = xUrl.searchParams.get("text") || "";
  expect(text).toContain("SunshineOptimist.com");
});
