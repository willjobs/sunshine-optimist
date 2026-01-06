// @ts-check
import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
} from "./helpers/mock-network.js";
import { waitForLoadingOverlayToFinish } from "./helpers/ui.js";

test("default location loads when no stored location is available", async ({ page }) => {
  await installFontMocks(page);
  await installPermissionsMock(page, "denied");
  await installApiMocks(page);
  await page.addInitScript(() => {
    window.localStorage.removeItem("sunshine-optimist:active-location");
  });

  await page.goto("/");
  await waitForLoadingOverlayToFinish(page);

  const cityInput = page.getByRole("combobox", { name: "City" });
  await expect(cityInput).toHaveValue("Boston, MA");
});
