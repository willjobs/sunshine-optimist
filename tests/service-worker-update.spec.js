// @ts-check
import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
} from "./helpers/mock-network.js";

test.use({ serviceWorkers: "allow" });

test("Safari installs a complete versioned cache and starts the app", async ({
  page,
}, testInfo) => {
  test.skip(!["webkit", "Mobile Safari"].includes(testInfo.project.name));
  await installFontMocks(page);
  await installPermissionsMock(page, "denied");
  await installApiMocks(page);

  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "City" })).toHaveValue("Boston, MA");

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) return null;
        const name = (await caches.keys()).find((key) =>
          key.startsWith("sunshine-optimist-static-")
        );
        if (!name) return null;
        const cache = await caches.open(name);
        const requests = await cache.keys();
        return requests.find((request) => request.url.includes("/scripts/state/app-state.js"))?.url;
      })
    )
    .toMatch(/\/scripts\/state\/app-state\.js\?v=v\d+-[a-f0-9]+$/);
});
