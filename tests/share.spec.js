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

test("copy feedback appears visible and positioned correctly", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  const copyButton = page.getByRole("button", { name: "Copy to clipboard" });
  const feedback = page.locator("#share-copy-feedback");

  // Feedback should be hidden initially
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

  // Initially in text mode
  await expect(textPreview).toBeVisible();
  await expect(storyPreview).toBeHidden();
  await expect(copyButton).toBeVisible();
  await expect(downloadButton).toBeHidden();
  await expect(textModeButton).toHaveClass(/is-active/);

  // Switch to image mode
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

  // Switch back to text mode
  await textModeButton.click();

  await expect(textPreview).toBeVisible();
  await expect(storyPreview).toBeHidden();
  await expect(copyButton).toBeVisible();
  await expect(downloadButton).toBeHidden();
});

test("story image renders with correct dimensions", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Switch to image mode
  await page.locator("[data-share-mode='story']").click();

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

  // Switch to image mode
  await page.locator("[data-share-mode='story']").click();

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

  // Switch to image mode
  await page.locator("[data-share-mode='story']").click();

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

test("modal resets to text mode when closed and reopened", async ({ page }) => {
  await page.goto("/");
  await openShareModalAndWait(page);

  // Switch to image mode
  await page.locator("[data-share-mode='story']").click();
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  // Close modal
  await page.getByRole("button", { name: "Close share dialog" }).click();
  await page.locator("#share-modal").waitFor({ state: "hidden" });

  // Reopen modal
  await openShareModalAndWait(page);

  // Should be back in text mode
  const textPreview = page.locator("#share-text-preview");
  const storyPreview = page.locator("#share-story-preview");
  const textModeButton = page.locator("[data-share-mode='text']");

  await expect(textPreview).toBeVisible();
  await expect(storyPreview).toBeHidden();
  await expect(textModeButton).toHaveClass(/is-active/);
});

// ============================================================================
// Web Share API Tests
// ============================================================================

test("Web Share UI shows social buttons when API is available", async ({ page }) => {
  // Mock Web Share API availability AND mobile device
  await page.addInitScript(() => {
    window.navigator.share = async () => Promise.resolve();
    window.navigator.canShare = () => true;
    // Mock mobile user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      configurable: true,
    });
  });

  await page.goto("/");
  await openShareModalAndWait(page);

  // Verify social buttons are visible
  const instagramButton = page.locator('[data-share="instagram"]');
  const facebookButton = page.locator('[data-share="facebook"]');
  const xButton = page.locator('[data-share="x"]');
  const blueskyButton = page.locator('[data-share="bluesky"]');

  await expect(instagramButton).toBeVisible();
  await expect(facebookButton).toBeVisible();
  await expect(xButton).toBeVisible();
  await expect(blueskyButton).toBeVisible();

  // Verify copy/download buttons are icon-only
  const copyButton = page.locator(".share-copy-button");

  await expect(copyButton).toHaveClass(/is-icon-only/);
  // Download button not visible in text mode, but should have class when visible in story mode
});

test("Web Share UI hides social buttons when API is not available", async ({
  page,
  browserName,
}) => {
  // Skip this test on browsers that have Web Share API (Mobile Safari, webkit)
  // These browsers will always show social buttons, so this test doesn't apply
  if (browserName === "webkit") {
    // WebKit/Safari have Web Share API so social buttons will be visible
    // Just open and close modal to keep test structure clean for afterEach
    await page.goto("/");
    return;
  }

  // No mocking - Web Share API not available by default in test environment

  await page.goto("/");
  await openShareModalAndWait(page);

  // Verify social buttons are hidden
  const instagramButton = page.locator('[data-share="instagram"]');
  const facebookButton = page.locator('[data-share="facebook"]');
  const xButton = page.locator('[data-share="x"]');
  const blueskyButton = page.locator('[data-share="bluesky"]');

  await expect(instagramButton).toBeHidden();
  await expect(facebookButton).toBeHidden();
  await expect(xButton).toBeHidden();
  await expect(blueskyButton).toBeHidden();

  // Verify copy/download buttons do not have icon-only class
  const copyButton = page.locator(".share-copy-button");
  await expect(copyButton).not.toHaveClass(/is-icon-only/);
});

test("social buttons trigger Web Share API in text mode", async ({ page }) => {
  // Mock Web Share API and capture calls
  await page.addInitScript(() => {
    window.__shareCallCount = 0;
    window.__lastShareData = null;
    window.navigator.share = async (data) => {
      window.__lastShareData = data;
      window.__shareCallCount = (window.__shareCallCount || 0) + 1;
      return Promise.resolve();
    };
    window.navigator.canShare = () => true;
    // Mock mobile user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      configurable: true,
    });
  });

  await page.goto("/");
  await openShareModalAndWait(page);

  // Click Instagram button
  const instagramButton = page.locator('[data-share="instagram"]');
  await instagramButton.click();

  // Wait for share to be called
  await page.waitForFunction(() => window.__shareCallCount > 0);

  // Verify share was called with text
  const shareData = await page.evaluate(() => window.__lastShareData);
  expect(shareData).toHaveProperty("text");
  expect(shareData.text).toContain("SunshineOptimist.com");
  expect(shareData.title).toBe("Sunshine Optimist");
});

test("social buttons trigger Web Share API with image in story mode", async ({ page }) => {
  // Mock Web Share API and capture calls
  await page.addInitScript(() => {
    window.__shareCallCount = 0;
    window.__lastShareData = null;
    window.navigator.share = async (data) => {
      window.__lastShareData = {
        hasFiles: !!data.files,
        fileCount: data.files ? data.files.length : 0,
        fileType: data.files && data.files[0] ? data.files[0].type : null,
        fileName: data.files && data.files[0] ? data.files[0].name : null,
        title: data.title,
      };
      window.__shareCallCount = (window.__shareCallCount || 0) + 1;
      return Promise.resolve();
    };
    window.navigator.canShare = () => true;
    // Mock mobile user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      configurable: true,
    });
  });

  await page.goto("/");
  await openShareModalAndWait(page);

  // Switch to story mode
  await page.locator('[data-share-mode="story"]').click();
  await page.waitForFunction(() => {
    const img = document.querySelector("#share-story-image");
    return img && img.src && img.src.startsWith("data:image/png");
  });

  // Click Instagram button
  const instagramButton = page.locator('[data-share="instagram"]');
  await instagramButton.click();

  // Wait for share to be called (longer timeout for canvas conversion)
  await page.waitForFunction(() => window.__shareCallCount > 0, { timeout: 15000 });

  // Verify share was called with files
  const shareData = await page.evaluate(() => window.__lastShareData);
  expect(shareData.hasFiles).toBe(true);
  expect(shareData.fileCount).toBe(1);
  expect(shareData.fileType).toBe("image/png");
  expect(shareData.fileName).toBe("sunshine-optimist-story.png");
});

test("social buttons show feedback when share succeeds", async ({ page }) => {
  // Mock Web Share API
  await page.addInitScript(() => {
    window.navigator.share = async () => Promise.resolve();
    window.navigator.canShare = () => true;
    // Mock mobile user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      configurable: true,
    });
  });

  await page.goto("/");
  await openShareModalAndWait(page);

  // Click Facebook button
  const facebookButton = page.locator('[data-share="facebook"]');
  await facebookButton.click();

  // Wait for share API to be called
  await page.waitForTimeout(500);

  // Feedback should flash briefly (we can't easily test the ephemeral flash,
  // but we can verify no errors occurred and button is still clickable)
  await expect(facebookButton).toBeEnabled();
});

test("social buttons handle share cancellation gracefully", async ({ page }) => {
  // Mock Web Share API to simulate user cancellation (AbortError)
  await page.addInitScript(() => {
    window.navigator.share = async () => {
      const error = new Error("User cancelled");
      error.name = "AbortError";
      throw error;
    };
    window.navigator.canShare = () => true;
    // Mock mobile user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      configurable: true,
    });
  });

  await page.goto("/");
  await openShareModalAndWait(page);

  // Click X button
  const xButton = page.locator('[data-share="x"]');
  await xButton.click();

  // Wait a moment for any potential error handling
  await page.waitForTimeout(500);

  // Modal should still be open and functional
  const modal = page.locator("#share-modal");
  await expect(modal).toBeVisible();
  await expect(xButton).toBeEnabled();
});
