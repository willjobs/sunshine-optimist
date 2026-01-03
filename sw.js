/**
 * Service Worker for Sunshine Optimist
 *
 * Provides offline support by caching static assets.
 * Uses a cache-first strategy for static assets.
 */

const CACHE_VERSION = "v85-8e1985e";
const STATIC_CACHE_NAME = `sunshine-optimist-static-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/favicon.svg",
  "/astronomy-engine/astronomy.browser.min.js",
  "/scripts/app.js",
  "/scripts/messages.js",
  "/scripts/milestones.js",
  "/scripts/formatters/formatters.js",
  "/scripts/controllers/date-controller.js",
  "/scripts/controllers/daylight-controller.js",
  "/scripts/controllers/location-controller.js",
  "/scripts/controllers/optimistic-controller.js",
  "/scripts/services/geocoding-service.js",
  "/scripts/services/reverse-geocode-service.js",
  "/scripts/services/storage-service.js",
  "/scripts/state/app-state.js",
  "/scripts/ui/confetti-ui.js",
  "/scripts/ui/message-ui.js",
  "/scripts/ui/milestone-ui.js",
  "/scripts/ui/share-modal-ui.js",
  "/scripts/ui/tooltip-ui.js",
  "/scripts/utils/astronomy-utils.js",
  "/scripts/utils/date-utils.js",
  "/scripts/utils/dom-utils.js",
  "/scripts/utils/location-utils.js",
  "/scripts/utils/utils.js",
];

/**
 * Install event - cache static assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        // eslint-disable-next-line no-console
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Activate immediately without waiting for existing tabs to close
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versioned caches
              return cacheName.startsWith("sunshine-optimist-") && cacheName !== STATIC_CACHE_NAME;
            })
            .map((cacheName) => {
              // eslint-disable-next-line no-console
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

/**
 * Handle static asset requests (cache-first strategy)
 */
const handleStaticRequest = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return a basic offline page for navigation requests
    if (request.mode === "navigate") {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match("/index.html");
    }
    throw error;
  }
};

/**
 * Fetch event - handle same-origin static assets only
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Only handle same-origin requests (static assets)
  // Let third-party API requests and external resources (like Google Fonts)
  // go directly to the network with their own caching headers
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(event.request));
  }
});
