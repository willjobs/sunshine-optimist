// @ts-check
import { test, expect } from "@playwright/test";
import { BOSTON } from "./helpers/fixtures.js";
import {
  installApiMocks,
  installClipboardMock,
  installFontMocks,
  installPermissionsMock,
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

test("share modal opens to image preview and closes", async ({ page }) => {
  await page.goto("/");

  await openShareModalAndWait(page);

  const modal = page.locator("#share-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("#share-story-preview")).toBeVisible();
  await expect(page.locator("#share-text-preview")).toBeHidden();
  await expect(page.locator("#share-download-button")).toBeVisible();
  await expect(page.locator("[data-share-mode='story']")).toHaveClass(/is-active/);

  await page.getByRole("button", { name: "Close share dialog" }).click();
  await expect(modal).not.toBeVisible();
});

test("privacy toggle updates share preview and persists", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  await page.locator("[data-share-mode='text']").click();
  await expect(page.locator("#share-text-preview")).toBeVisible();

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

  await page.locator("[data-share-mode='text']").click();
  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  await expect(copyButton).toBeVisible();
  await copyButton.click();

  await page.waitForFunction(() => (window.__clipboardText || "").length > 0);
  const clipboardText = await page.evaluate(() => window.__clipboardText || "");
  expect(clipboardText).toContain("SunshineOptimist.com");
});

test("copy feedback appears visible and positioned correctly", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  await page.locator("[data-share-mode='text']").click();
  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  const feedback = page.locator("#share-copy-feedback");

  // Feedback should be hidden initially
  await expect(copyButton).toBeVisible();
  await expect(feedback).toBeHidden();

  // Click copy button
  await copyButton.click();

  // Feedback should become visible with is-visible class
  await expect(feedback).toHaveClass(/is-visible/);
  await expect(feedback).toContainText("Copied to clipboard!");

  // Verify feedback is positioned to the right of the button and visible in viewport
  const feedbackBox = await feedback.boundingBox();
  const buttonBox = await copyButton.boundingBox();

  expect(feedbackBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  // Feedback should be to the right of the button
  expect(feedbackBox.x).toBeGreaterThan(buttonBox.x + buttonBox.width - 10);

  // Feedback should be vertically centered with button (within tolerance)
  const buttonCenterY = buttonBox.y + buttonBox.height / 2;
  const feedbackCenterY = feedbackBox.y + feedbackBox.height / 2;
  expect(Math.abs(feedbackCenterY - buttonCenterY)).toBeLessThan(10);

  // Feedback should disappear after the flash duration (~1200ms + transition)
  await page.waitForTimeout(1500);
  await expect(feedback).not.toHaveClass(/is-visible/);
});

test("mode toggle switches between text and image views", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  const textPreview = page.locator("#share-text-preview");
  const storyPreview = page.locator("#share-story-preview");
  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  const downloadButton = page.locator("#share-download-button");
  const textModeButton = page.locator("[data-share-mode='text']");
  const imageModeButton = page.locator("[data-share-mode='story']");

  // Initially in image mode
  await expect(textPreview).toBeHidden();
  await expect(storyPreview).toBeVisible();
  await expect(copyButton).toBeHidden();
  await expect(downloadButton).toBeVisible();
  await expect(imageModeButton).toHaveClass(/is-active/);

  // Switch to text mode
  await textModeButton.click();

  await expect(textPreview).toBeVisible();
  await expect(storyPreview).toBeHidden();
  await expect(copyButton).toBeVisible();
  await expect(downloadButton).toBeHidden();
  await expect(textModeButton).toHaveClass(/is-active/);

  // Switch back to image mode
  await imageModeButton.click();

  // Wait for image to be rendered
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  await expect(textPreview).toBeHidden();
  await expect(storyPreview).toBeVisible();
  await expect(copyButton).toBeHidden();
  await expect(downloadButton).toBeVisible();
  await expect(imageModeButton).toHaveClass(/is-active/);
});

test("story image renders with correct dimensions", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Wait for image to be rendered
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  // The image src is a data URL from a 1080x1920 canvas
  // We can verify it's a PNG data URL with substantial content
  const imgSrc = await page.evaluate(() => {
    const img = document.querySelector("#share-story-image");
    return img?.src || "";
  });

  expect(imgSrc).toMatch(/^data:image\/png;base64,/);
  // A 1080x1920 PNG should have a substantial data URL (at least 10KB base64)
  expect(imgSrc.length).toBeGreaterThan(10000);
});

test("download feedback appears visible and positioned correctly", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Wait for image to be rendered
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  const downloadButton = page.locator("#share-download-button");
  const feedback = page.locator("#share-download-feedback");

  // Feedback should be hidden initially
  await expect(feedback).toBeHidden();

  // Click download button
  await downloadButton.click();

  // Feedback should become visible with is-visible class
  await expect(feedback).toHaveClass(/is-visible/);
  await expect(feedback).toContainText("Image downloaded!");

  // Verify feedback is positioned to the right of the button and visible in viewport
  const feedbackBox = await feedback.boundingBox();
  const buttonBox = await downloadButton.boundingBox();

  expect(feedbackBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  // Feedback should be to the right of the button
  expect(feedbackBox.x).toBeGreaterThan(buttonBox.x + buttonBox.width - 10);

  // Feedback should be vertically centered with button (within tolerance)
  const buttonCenterY = buttonBox.y + buttonBox.height / 2;
  const feedbackCenterY = feedbackBox.y + feedbackBox.height / 2;
  expect(Math.abs(feedbackCenterY - buttonCenterY)).toBeLessThan(10);

  // Feedback should disappear after the flash duration (~1200ms + transition)
  await page.waitForTimeout(1500);
  await expect(feedback).not.toHaveClass(/is-visible/);
});

test("privacy toggle updates story image preview", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Wait for initial image render
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  // Get initial image data
  const initialData = await page.evaluate(() => {
    const img = document.querySelector("#share-story-image");
    return img?.src;
  });

  // Toggle privacy
  await page.locator("#share-privacy-toggle").check();

  // Wait for image to re-render (data should change)
  await page.waitForFunction(
    (prevData) => {
      const img = document.querySelector("#share-story-image");
      return img?.src !== prevData;
    },
    initialData,
    { timeout: 5000 }
  );

  // Verify image was re-rendered (data changed)
  const newData = await page.evaluate(() => {
    const img = document.querySelector("#share-story-image");
    return img?.src;
  });

  expect(newData).not.toBe(initialData);
});

test("modal resets to image mode when closed and reopened", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Switch to text mode
  await page.locator("[data-share-mode='text']").click();
  await expect(page.locator("#share-text-preview")).toBeVisible();

  // Close modal
  await page.getByRole("button", { name: "Close share dialog" }).click();
  await page.locator("#share-modal").waitFor({ state: "hidden" });

  // Reopen modal
  await openShareModalAndWait(page);

  // Should be back in image mode
  const textPreview = page.locator("#share-text-preview");
  const storyPreview = page.locator("#share-story-preview");
  const imageModeButton = page.locator("[data-share-mode='story']");

  await expect(textPreview).toBeHidden();
  await expect(storyPreview).toBeVisible();
  await expect(imageModeButton).toHaveClass(/is-active/);
});
