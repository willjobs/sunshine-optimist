import { expect, test } from "@playwright/test";
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

test("a date change cannot open a share of the previous result", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#share")).toBeEnabled();
  const pending = await page.evaluate(() => {
    const input = document.querySelector("#date-input");
    input.value = "2030-04-15";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const button = document.querySelector("#share");
    button.click();
    return { disabled: button.disabled, open: document.querySelector("#share-modal").open };
  });
  expect(pending).toEqual({ disabled: true, open: false });
  await expect(page.locator("#share")).toBeEnabled({ timeout: 20000 });
  await page.locator("#share").click();
  await page.locator('[data-share-mode="text"]').click();
  await expect(page.locator("#share-preview")).toContainText(/Apr\.? 15/);
  const frozenDate = await page.evaluate(async () => {
    const { getModalSnapshot } = await import("/scripts/state/app-state.js");
    return getModalSnapshot().dateParts;
  });
  expect(frozenDate).toEqual({ year: 2030, month: 4, day: 15 });
});

test("reopening a story clears the previous image and disables exports while it renders", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#share").click();
  await expect(page.locator("#share-download-button")).toBeEnabled();
  await expect(page.locator("#share-story-image")).toHaveAttribute("src", /^data:image\/png/);
  await page.getByRole("button", { name: "Close share dialog" }).click();
  // Defer the same font-readiness dependency the real renderer awaits.
  await page.evaluate(() => {
    let release;
    const ready = new Promise((resolve) => {
      release = resolve;
    });
    Object.defineProperty(document.fonts, "ready", { configurable: true, value: ready });
    window.releaseStoryFonts = release;
  });
  await page.locator("#share").click();
  await expect(page.locator("#share-download-button")).toBeDisabled();
  await expect(page.locator("#share-story-image")).not.toHaveAttribute("src");
  await expect(page.locator("#share-story-status")).toHaveText("Preparing your image…");
  await page.evaluate(() => window.releaseStoryFonts());
  await expect(page.locator("#share-download-button")).toBeEnabled();
  await expect(page.locator("#share-story-image")).toHaveAttribute("src", /^data:image\/png/);
});

test("a saved city without a timezone is replaced by a location with a known timezone", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#share")).toBeEnabled();
  await page.evaluate(() =>
    localStorage.setItem(
      "sunshine-optimist:active-location",
      JSON.stringify({ name: "Seattle", latitude: 47.6062, longitude: -122.3321 })
    )
  );
  await page.reload();
  await expect(page.getByRole("combobox", { name: "City" })).toHaveValue("Boston, MA");
  await expect(page.locator("#share")).toBeEnabled();
  const zone = await page.evaluate(async () => {
    const { getActiveLocation } = await import("/scripts/state/app-state.js");
    return getActiveLocation().timezone;
  });
  expect(zone).toBe("America/New_York");
});
