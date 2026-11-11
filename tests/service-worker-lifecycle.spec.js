// @ts-check
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { BOSTON } from "./helpers/fixtures.js";
import { installFontMocks, setStoredLocation } from "./helpers/mock-network.js";

test.use({ serviceWorkers: "allow" });

test("offline installation and release updates preserve the running page", async ({
  page,
  context,
}) => {
  // Serve two real releases without changing the checkout. Delay the first worker
  // until the app displays its messages to reproduce the reported startup timing.
  const root = resolve(import.meta.dirname, "..");
  const originalWorker = await readFile(resolve(root, "sw.js"), "utf8");
  const originalVersion = originalWorker.match(/const CACHE_VERSION = "([^"]+)"/)[1];
  let version = originalVersion;
  let releaseWorker;
  const workerGate = new Promise((resolve) => {
    releaseWorker = resolve;
  });
  const contentTypes = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    svg: "image/svg+xml",
    webmanifest: "application/manifest+json",
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (pathname === "/sw.js") {
        await workerGate;
      }
      const source = await readFile(path);
      const body = /\/(index\.html|sw\.js)$/.test(path)
        ? source.toString().replaceAll(originalVersion, version)
        : source;
      response.writeHead(200, {
        "Content-Type": contentTypes[path.split(".").pop()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server failed to bind");
  }
  const url = `http://127.0.0.1:${address.port}/`;

  try {
    await installFontMocks(page);
    await setStoredLocation(page, BOSTON);
    await page.addInitScript(() => {
      const count = Number(sessionStorage.getItem("document-loads") || 0) + 1;
      sessionStorage.setItem("document-loads", String(count));
    });
    await page.goto(url);
    await expect(page.locator("#headline")).not.toHaveAttribute("data-loading", "true");
    await expect(page.locator("#daylight-duration")).not.toHaveText("—");
    await page.locator("#date-input").fill("2026-02-15");
    await page.locator("#date-input").press("Enter");

    releaseWorker();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    // Cross rendering frames after takeover so a scheduled reload can complete.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    expect(await page.evaluate(() => sessionStorage.getItem("document-loads"))).toBe("1");
    await expect(page.locator("#date-input")).toHaveValue("2026-02-15");
    expect(await page.evaluate(() => caches.keys())).toContain(
      `sunshine-optimist-static-${originalVersion}`
    );

    // A subsequent release must wait while this page uses the original release.
    version = `${originalVersion}-update`;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration.waiting?.state;
        })
      )
      .toBe("installed");
    expect(await page.evaluate(() => sessionStorage.getItem("document-loads"))).toBe("1");
    await expect(page.locator("#date-input")).toHaveValue("2026-02-15");

    // Closing the last client permits activation. The next visit gets the update.
    await page.close();
    const nextPage = await context.newPage();
    await nextPage.goto(url);
    await expect
      .poll(() =>
        nextPage.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            active: registration.active?.state,
            waiting: Boolean(registration.waiting),
            caches: await caches.keys(),
          };
        })
      )
      .toEqual({
        active: "activated",
        waiting: false,
        caches: expect.arrayContaining([`sunshine-optimist-static-${version}`]),
      });
    await expect(nextPage.locator("#headline")).not.toHaveAttribute("data-loading", "true");
    await expect(nextPage.locator("#daylight-duration")).not.toHaveText("—");
    await expect(nextPage.locator('script[src^="scripts/app.js"]')).toHaveAttribute(
      "src",
      `scripts/app.js?v=${version}`
    );
    expect(await nextPage.evaluate(() => caches.keys())).not.toContain(
      `sunshine-optimist-static-${originalVersion}`
    );
  } finally {
    releaseWorker();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
