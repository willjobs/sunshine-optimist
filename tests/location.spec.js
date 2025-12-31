// @ts-check
import { test, expect } from "@playwright/test";
import {
  BOSTON,
  PARIS_FR,
  PARIS_TX,
  SAN_FRANCISCO,
  SAN_JOSE,
  SEATTLE,
} from "./helpers/fixtures.js";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
  setStoredLocation,
} from "./helpers/mock-network.js";

const setupPage = async (page, { geocodeFixtures } = {}) => {
  await installFontMocks(page);
  await installPermissionsMock(page, "denied");
  await installApiMocks(page, { geocodeFixtures });
  await setStoredLocation(page, BOSTON);
};

test("city search renders results and selection updates input", async ({ page }) => {
  await setupPage(page);
  await page.goto("/");

  const cityInput = page.getByRole("combobox", { name: "City" });
  await cityInput.fill("Paris");

  const parisTexas = page.getByRole("option", {
    name: "Paris, TX, United States",
  });
  await expect(parisTexas).toBeVisible();

  await parisTexas.click();
  await expect(cityInput).toHaveValue("Paris, TX");
  await expect(cityInput).toHaveAttribute("aria-expanded", "false");
});

test("keyboard navigation updates active option", async ({ page }) => {
  await setupPage(page, {
    geocodeFixtures: {
      san: [SAN_FRANCISCO, SAN_JOSE],
      boston: [BOSTON],
    },
  });
  await page.goto("/");

  const cityInput = page.getByRole("combobox", { name: "City" });
  await cityInput.fill("San");

  const options = page.locator(".location-option");
  await expect(options).toHaveCount(2);

  await expect(options.first()).toHaveClass(/is-active/);
  await page.keyboard.press("ArrowDown");

  const activeOption = page.locator(".location-option.is-active");
  await expect(activeOption).toHaveText("San Jose, CA, United States");
  await expect(cityInput).toHaveAttribute("aria-activedescendant", /location-option-/);
});

test("clear button shows recent locations", async ({ page }) => {
  await setupPage(page);
  await page.goto("/");

  const cityInput = page.getByRole("combobox", { name: "City" });
  await cityInput.fill("Paris");

  const parisTexas = page.getByRole("option", {
    name: "Paris, TX, United States",
  });
  await parisTexas.click();

  await page.getByRole("button", { name: "Clear location" }).click();
  await expect(page.locator("#location-results-meta")).toHaveText(/Recent locations/);
  await expect(page.getByRole("option", { name: "Paris, TX, United States" })).toBeVisible();
});

test("toggle shows worldwide results when local is preferred", async ({ page }) => {
  await setupPage(page, {
    geocodeFixtures: {
      paris: [PARIS_TX, PARIS_FR],
      boston: [BOSTON],
    },
  });
  await page.goto("/");

  const cityInput = page.getByRole("combobox", { name: "City" });
  await cityInput.fill("Paris");

  await expect(page.getByRole("option", { name: "Paris, TX, United States" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show worldwide results" })).toBeVisible();

  await page.getByRole("button", { name: "Show worldwide results" }).click();
  await expect(page.getByRole("option", { name: "Paris, TX, United States" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Paris, Ile-de-France, France" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prefer local results" })).toBeVisible();
});

test("geolocation selection resolves to a place name", async ({ page }) => {
  await setupPage(page);
  await page.addInitScript(
    (coords) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (success) => {
            success({ coords });
          },
        },
        configurable: true,
      });
    },
    {
      latitude: SEATTLE.latitude,
      longitude: SEATTLE.longitude,
    }
  );

  await page.goto("/");

  const geolocateButton = page.getByRole("button", { name: "Use my location" });
  await geolocateButton.click();

  const cityInput = page.getByRole("combobox", { name: "City" });
  await expect(cityInput).toHaveValue("Seattle, WA");
});
