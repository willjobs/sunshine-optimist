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

// Run share tests serially to avoid Firefox race conditions
test.describe.configure({ mode: "serial" });

/**
 * Open share modal and wait for it to be fully ready
 * This addresses Firefox timing issues with dialog element rendering
 */
const openShareModalAndWait = async (page) => {
  // Wait for page to be fully loaded and interactive
  await page.waitForLoadState("networkidle");

  const shareButton = page.getByRole("button", { name: /Share Your Sunlight/i });
  // Ensure button is ready and stable before clicking
  await shareButton.waitFor({ state: "visible" });
  await expect(shareButton).toBeEnabled();
  await shareButton.click();

  // Wait for dialog to have the 'open' attribute (native dialog behavior)
  const modal = page.locator("#share-modal");
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector("#share-modal");
      return dialog?.hasAttribute("open");
    },
    { timeout: 10000 }
  );
  await modal.waitFor({ state: "visible" });

  // Wait for preview content to be populated (not "Preparing...")
  await page.waitForFunction(
    () => {
      const preview = document.querySelector("#share-preview");
      const text = preview?.textContent || "";
      return text.includes("SunshineOptimist.com");
    },
    { timeout: 10000 }
  );
};

test.beforeEach(async ({ page }) => {
  await installFontMocks(page);
  await installApiMocks(page);
  await installPermissionsMock(page, "denied");
  await installClipboardMock(page);
  await installWindowOpenMock(page);
  await setStoredLocation(page, BOSTON);
});

test.afterEach(async ({ page }) => {
  // Ensure modal is closed after each test for proper isolation
  const modal = page.locator("#share-modal");
  if ((await modal.getAttribute("open")) !== null) {
    await page.getByRole("button", { name: "Close share dialog" }).click();
    await modal.waitFor({ state: "hidden" });
  }
});

test("share modal opens, previews text, and closes", async ({ page }) => {
  await page.goto("/");

  await openShareModalAndWait(page);

  const modal = page.locator("#share-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("#share-preview")).toHaveText(/SunshineOptimist\.com/);

  await page.getByRole("button", { name: "Close share dialog" }).click();
  await expect(modal).not.toBeVisible();
});

test("privacy toggle updates share preview and persists", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

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
  await openShareModalAndWait(page);

  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  await copyButton.click();

  await page.waitForFunction(() => (window.__clipboardText || "").length > 0);
  const clipboardText = await page.evaluate(() => window.__clipboardText || "");
  expect(clipboardText).toContain("SunshineOptimist.com");
});

test("share links open with encoded text", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  await page.getByRole("button", { name: "Share to X" }).click();

  await page.waitForFunction(() => (window.__openedUrls || []).length > 0);
  const openedUrls = await page.evaluate(() => window.__openedUrls || []);
  expect(openedUrls.length).toBeGreaterThan(0);

  const xUrl = new URL(openedUrls[0]);
  expect(xUrl.hostname).toBe("twitter.com");
  const text = xUrl.searchParams.get("text") || "";
  expect(text).toContain("SunshineOptimist.com");
});
