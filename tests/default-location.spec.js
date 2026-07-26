// @ts-check
import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
} from "./helpers/mock-network.js";
import { BOSTON, PARIS_TX } from "./helpers/fixtures.js";

test("default location loads when no stored location is available", async ({ page }) => {
  await installFontMocks(page);
  await installPermissionsMock(page, "denied");
  await installApiMocks(page);
  await page.addInitScript(() => {
    window.localStorage.removeItem("sunshine-optimist:active-location");
  });

  await page.goto("/");

  const cityInput = page.getByRole("combobox", { name: "City" });
  await expect(cityInput).toHaveValue("Boston, MA");
});

test("delayed startup fallback does not overwrite a manual selection", async ({ page }) => {
  await installFontMocks(page);
  await installPermissionsMock(page, "denied");
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  let releaseBoston;
  const bostonRequested = new Promise((resolve) => {
    releaseBoston = resolve;
  });
  let allowBostonResponse;
  const bostonResponseAllowed = new Promise((resolve) => {
    allowBostonResponse = resolve;
  });

  await page.route("https://geocoding-api.open-meteo.com/v1/search**", async (route) => {
    const url = new URL(route.request().url());
    const name = url.searchParams.get("name")?.toLowerCase();
    if (name === "boston") {
      releaseBoston();
      await bostonResponseAllowed;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [BOSTON] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: name === "paris" ? [PARIS_TX] : [] }),
    });
  });

  await page.goto("/");
  await bostonRequested;

  const cityInput = page.getByRole("combobox", { name: "City" });
  await cityInput.fill("Paris");
  await page.getByRole("option", { name: "Paris, TX" }).click();
  await expect(cityInput).toHaveValue("Paris, TX");

  allowBostonResponse();
  await expect(cityInput).toHaveValue("Paris, TX");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("sunshine-optimist:active-location") || "null")
      )
    )
    .toMatchObject({ name: "Paris", admin1: "Texas" });
});
