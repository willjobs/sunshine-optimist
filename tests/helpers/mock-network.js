import { BOSTON, PARIS_FR, PARIS_TX, SEATTLE } from "./fixtures.js";

const toJson = (data) => JSON.stringify(data);

export const disableServiceWorker = async (page) => {
  // Block the service worker script from loading - must be set up BEFORE any navigation
  await page.route("**/sw.js", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "// Service worker disabled for testing",
    });
  });

  // Unregister any existing service workers and clear caches before page loads
  await page.addInitScript(() => {
    // Immediately unregister all service workers
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      // Also clear service worker caches
      if ("caches" in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => caches.delete(cacheName));
        });
      }
    }
  });
};

const normalizeQuery = (value) => (value || "").trim().toLowerCase();

export const defaultGeocodeFixtures = {
  boston: [BOSTON],
  paris: [PARIS_TX, PARIS_FR],
};

export const defaultReverseGeocodeResponse = {
  locality: SEATTLE.name,
  principalSubdivision: SEATTLE.admin1,
  countryName: SEATTLE.country,
  countryCode: SEATTLE.country_code,
  latitude: SEATTLE.latitude,
  longitude: SEATTLE.longitude,
};

export const installFontMocks = async (page) => {
  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "font/woff2",
      body: "",
    });
  });
};

export const installApiMocks = async (
  page,
  {
    geocodeFixtures = defaultGeocodeFixtures,
    reverseGeocodeResponse = defaultReverseGeocodeResponse,
    timezoneResponse = SEATTLE.timezone,
  } = {}
) => {
  await page.route("https://geocoding-api.open-meteo.com/v1/search**", async (route) => {
    const url = new URL(route.request().url());
    const name = normalizeQuery(url.searchParams.get("name"));
    const results = geocodeFixtures[name] || [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: toJson({ results }),
    });
  });

  await page.route("https://api.bigdatacloud.net/data/reverse-geocode-client**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: toJson(reverseGeocodeResponse),
    });
  });

  await page.route("https://api.open-meteo.com/v1/forecast**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: toJson({ timezone: timezoneResponse }),
    });
  });
};

export const installPermissionsMock = async (page, state = "denied") => {
  await page.addInitScript((permissionState) => {
    if (!navigator.permissions?.query) {
      return;
    }
    navigator.permissions.query = async () => ({ state: permissionState });
  }, state);
};

export const installClipboardMock = async (page) => {
  await page.addInitScript(() => {
    window.__clipboardText = "";
    const clipboard = {
      writeText: async (text) => {
        window.__clipboardText = text;
      },
    };
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: clipboard,
        configurable: true,
      });
    } catch {
      if (navigator.clipboard) {
        navigator.clipboard.writeText = clipboard.writeText;
        return;
      }
      Object.defineProperty(Navigator.prototype, "clipboard", {
        get: () => clipboard,
      });
    }
  });
};

export const installWindowOpenMock = async (page) => {
  await page.addInitScript(() => {
    window.__openedUrls = [];
    window.open = (url) => {
      if (url) {
        window.__openedUrls.push(url);
      }
      return null;
    };
  });
};

export const setStoredLocation = async (page, location) => {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("sunshine-optimist:active-location", JSON.stringify(stored));
  }, location);
};

export const setSharePrivacyPreference = async (page, enabled) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sunshine-optimist:share-privacy", value ? "true" : "false");
  }, enabled);
};

export const clearStoredState = async (page) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
};
