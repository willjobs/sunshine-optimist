// @ts-check
import { test, expect } from "@playwright/test";

/**
 * Mobile Usability Audit Test Suite
 *
 * This test suite performs a comprehensive mobile usability audit by:
 * - Testing multiple mobile viewports (small phone, standard phone, larger phone)
 * - Capturing screenshots of all major UI states
 * - Testing interactive elements and modals
 * - Documenting potential usability issues
 */

// Custom mobile viewports to test various device sizes
const mobileViewports = [
  { name: "iPhone SE (Small)", width: 375, height: 667 },
  { name: "iPhone 12 (Standard)", width: 390, height: 844 },
  { name: "Pixel 5 (Android)", width: 393, height: 851 },
  { name: "iPhone 14 Pro Max (Large)", width: 430, height: 932 },
];

test.describe("Mobile Usability Audit", () => {
  for (const viewport of mobileViewports) {
    test.describe(`${viewport.name} - ${viewport.width}x${viewport.height}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        // Disable service workers to ensure route mocking works
        serviceWorkers: "block",
      });

      test("01 - Initial page load state", async ({ page }) => {
        await page.goto("/");

        // Wait for the page to be fully loaded
        await page.waitForLoadState("networkidle");

        // Take a full page screenshot
        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-01-initial-load.png`,
          fullPage: true,
        });
      });

      test("02 - Location input focused state", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Focus on the location input
        const cityInput = page.locator("#city-input");
        await cityInput.click();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-02-location-input-focused.png`,
          fullPage: true,
        });
      });

      test("03 - Location search results", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Mock the geocoding API
        await page.route("**/geocode/v1/**", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              results: [
                {
                  formatted: "New York, NY, USA",
                  geometry: { lat: 40.7128, lng: -74.006 },
                  components: {
                    city: "New York",
                    state: "New York",
                    country: "USA",
                  },
                },
                {
                  formatted: "Newark, NJ, USA",
                  geometry: { lat: 40.7357, lng: -74.1724 },
                  components: {
                    city: "Newark",
                    state: "New Jersey",
                    country: "USA",
                  },
                },
              ],
            }),
          });
        });

        const cityInput = page.locator("#city-input");
        await cityInput.fill("New");
        await page.waitForTimeout(600); // Wait for debounce

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-03-location-results.png`,
          fullPage: true,
        });
      });

      test("04 - Main content with stats", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Focus on the main content card
        const card = page.locator(".card");
        await card.scrollIntoViewIfNeeded();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-04-main-content-stats.png`,
          fullPage: true,
        });
      });

      test("05 - Sunset and Daylight stats detailed view", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Scroll to stats section
        const statRow = page.locator(".stat-row");
        await statRow.scrollIntoViewIfNeeded();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-05-stats-section.png`,
          fullPage: false,
        });
      });

      test("06 - Milestone section", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const milestone = page.locator(".milestone");
        await milestone.scrollIntoViewIfNeeded();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-06-milestone-section.png`,
          fullPage: false,
        });
      });

      test("07 - Share button and footer area", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const shareSection = page.locator(".share");
        await shareSection.scrollIntoViewIfNeeded();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-07-share-section.png`,
          fullPage: true,
        });
      });

      test("08 - Share modal opened", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Click the share button
        const shareButton = page.locator("#share");
        await shareButton.click();

        // Wait for modal to be visible
        const modal = page.locator("#share-modal");
        await expect(modal).toBeVisible();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-08-share-modal.png`,
          fullPage: false,
        });
      });

      test("09 - Share modal text preview", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const shareButton = page.locator("#share");
        await shareButton.click();

        const modal = page.locator("#share-modal");
        await expect(modal).toBeVisible();

        // Ensure we're on text mode
        const textButton = page.locator('[data-share-mode="text"]');
        await textButton.click();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-09-share-modal-text.png`,
          fullPage: false,
        });
      });

      test("10 - Share modal image mode", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const shareButton = page.locator("#share");
        await shareButton.click();

        const modal = page.locator("#share-modal");
        await expect(modal).toBeVisible();

        // Switch to image mode
        const imageButton = page.locator('[data-share-mode="story"]');
        await imageButton.click();
        await page.waitForTimeout(500); // Wait for canvas to render

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-10-share-modal-image.png`,
          fullPage: false,
        });
      });

      test("11 - Date picker interaction", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Click on date input
        const dateInput = page.locator("#date-input");
        await dateInput.click();

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-11-date-picker.png`,
          fullPage: true,
        });
      });

      test("12 - Touch target sizes - interactive elements", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Highlight all interactive elements to assess touch target sizes
        await page.addStyleTag({
          content: `
            button, input[type="date"], [role="button"], a {
              outline: 2px solid red !important;
              outline-offset: 2px !important;
            }
          `,
        });

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-12-touch-targets.png`,
          fullPage: true,
        });
      });

      test("13 - Text readability assessment", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Highlight all text elements to assess font sizes
        await page.addStyleTag({
          content: `
            h1, h2, h3, p, span, button, input, .delta-text, .delta-emphasis {
              background: rgba(255, 255, 0, 0.2) !important;
            }
          `,
        });

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-13-text-readability.png`,
          fullPage: true,
        });
      });

      test("14 - Landscape orientation", async ({ page }) => {
        // Set landscape viewport
        await page.setViewportSize({
          width: viewport.height,
          height: viewport.width,
        });

        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await page.screenshot({
          path: `audit-screenshots/${viewport.name.replace(/\s+/g, "-")}-14-landscape.png`,
          fullPage: true,
        });
      });
    });
  }

  // Additional cross-device comparison test
  test("15 - Device size comparison", async ({ page }) => {
    const comparisonViewport = { width: 375, height: 667 };
    await page.setViewportSize(comparisonViewport);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.screenshot({
      path: "audit-screenshots/comparison-small-device.png",
      fullPage: true,
    });
  });
});
