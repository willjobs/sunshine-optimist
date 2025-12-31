/**
 * Service Worker for Sunshine Optimist
 *
 * Provides offline support by caching static assets and API responses.
 * Uses a cache-first strategy for static assets and a network-first
 * strategy for API calls with stale-while-revalidate behavior.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE_NAME = `sunshine-optimist-static-${CACHE_VERSION}`;
const API_CACHE_NAME = `sunshine-optimist-api-${CACHE_VERSION}`;

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

// API endpoints to cache
const API_HOSTS = ["geocoding-api.open-meteo.com", "api.bigdatacloud.net"];

// Cache duration for API responses (24 hours in milliseconds)
const API_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

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
              return (
                cacheName.startsWith("sunshine-optimist-") &&
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== API_CACHE_NAME
              );
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
 * Check if a URL is an API request
 */
const isApiRequest = (url) => {
  return API_HOSTS.some((host) => url.hostname === host);
};

/**
 * Check if a cached response is still valid
 */
const isCacheValid = (response) => {
  if (!response) return false;
  const cachedTime = response.headers.get("sw-cached-time");
  if (!cachedTime) return true; // If no timestamp, treat as valid
  const age = Date.now() - parseInt(cachedTime, 10);
  return age < API_CACHE_MAX_AGE;
};

/**
 * Add timestamp header to response for cache validation
 */
const addCacheTimestamp = async (response) => {
  const clonedResponse = response.clone();
  const body = await clonedResponse.blob();
  const headers = new Headers(clonedResponse.headers);
  headers.set("sw-cached-time", Date.now().toString());
  return new Response(body, {
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers,
  });
};

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
 * Handle API requests (network-first with stale-while-revalidate)
 */
const handleApiRequest = async (request) => {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the successful response with timestamp
      const timestampedResponse = await addCacheTimestamp(networkResponse);
      cache.put(request, timestampedResponse);
      return networkResponse;
    }
    // If network returned an error but we have cache, use it
    if (cachedResponse && isCacheValid(cachedResponse)) {
      return cachedResponse;
    }
    return networkResponse;
  } catch (error) {
    // Network failed, try to serve from cache
    if (cachedResponse && isCacheValid(cachedResponse)) {
      // eslint-disable-next-line no-console
      console.log("[SW] Serving API response from cache:", request.url);
      return cachedResponse;
    }
    throw error;
  }
};

/**
 * Fetch event - route requests to appropriate handler
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

  // Handle API requests
  if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets (same origin only)
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // For external resources (like Google Fonts), use network-only
  // as they have their own caching headers
});
