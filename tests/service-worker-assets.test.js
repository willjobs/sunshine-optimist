import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const projectRoot = resolve(import.meta.dirname, "..");
const serviceWorkerSource = readFileSync(resolve(projectRoot, "sw.js"), "utf8");
const indexSource = readFileSync(resolve(projectRoot, "index.html"), "utf8");
const cacheVersion = serviceWorkerSource.match(/const CACHE_VERSION = "([^"]+)"/)?.[1];

const readStaticAssets = () => {
  const declaration = serviceWorkerSource.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/)?.[1];
  if (!declaration) {
    throw new Error("Unable to find STATIC_ASSETS in sw.js");
  }
  return new Set([...declaration.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]));
};

const readRuntimeModuleGraph = () => {
  const visited = new Set();
  const pending = ["/scripts/app.js"];
  const importPattern = /(?:import|export)\s+(?:[^;]*?\sfrom\s+)?["'](\.[^"']+)["']/g;

  while (pending.length) {
    const assetPath = pending.pop();
    if (visited.has(assetPath)) {
      continue;
    }
    visited.add(assetPath);

    const source = readFileSync(resolve(projectRoot, assetPath.slice(1)), "utf8");
    for (const match of source.matchAll(importPattern)) {
      const importedPath = posix.normalize(posix.join(posix.dirname(assetPath), match[1]));
      const normalizedPath = importedPath.endsWith(".js") ? importedPath : `${importedPath}.js`;
      pending.push(normalizedPath);
    }
  }

  return visited;
};

describe("service worker static cache", () => {
  it("contains every JavaScript module reachable from the app entry point", () => {
    const staticAssets = readStaticAssets();
    const runtimeModules = readRuntimeModuleGraph();
    const missingModules = [...runtimeModules].filter(
      (modulePath) => !staticAssets.has(modulePath)
    );

    expect(missingModules).toEqual([]);
  });

  it("references assets that exist in the project", () => {
    const missingFiles = [...readStaticAssets()]
      .filter((assetPath) => assetPath !== "/")
      .filter((assetPath) => !existsSync(resolve(projectRoot, assetPath.slice(1))));

    expect(missingFiles).toEqual([]);
  });

  it("versions every imported module so a new page cannot reuse old HTTP-cached modules", () => {
    const importMapSource = indexSource.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
    expect(importMapSource).toBeDefined();
    const imports = JSON.parse(importMapSource).imports;
    const modules = [...readRuntimeModuleGraph()].filter((path) => path !== "/scripts/app.js");

    for (const path of modules) {
      expect(imports[path]).toBe(`${path}?v=${cacheVersion}`);
    }
  });

  it("pre-caches a release with fresh versioned requests", async () => {
    const listeners = new Map();
    let precacheRequests;
    const cache = {
      addAll: async (requests) => {
        precacheRequests = requests;
      },
    };
    const context = {
      self: {
        addEventListener: (event, handler) => listeners.set(event, handler),
        location: { origin: "https://sunshineoptimist.com" },
        skipWaiting: async () => {},
      },
      caches: { open: async () => cache },
      Request,
      URL,
      console,
    };
    runInNewContext(serviceWorkerSource, context);

    let installation;
    listeners.get("install")({ waitUntil: (promise) => (installation = promise) });
    await installation;

    expect(precacheRequests).toHaveLength(readStaticAssets().size);
    for (const request of precacheRequests) {
      expect(request.cache).toBe("reload");
      expect(new URL(request.url).searchParams.get("v")).toBe(cacheVersion);
    }
  });

  it("does not read a previous release cache when an asset is missing", async () => {
    const listeners = new Map();
    const currentCache = { match: vi.fn(async () => null), put: vi.fn(async () => {}) };
    const oldCacheLookup = vi.fn(async () => new Response("old module"));
    const networkFetch = vi.fn(async () => new Response("current module"));
    runInNewContext(serviceWorkerSource, {
      self: {
        addEventListener: (event, handler) => listeners.set(event, handler),
        location: { origin: "https://sunshineoptimist.com" },
      },
      caches: { open: async () => currentCache, match: oldCacheLookup },
      fetch: networkFetch,
      Request,
      URL,
      console,
    });

    const request = new Request("https://sunshineoptimist.com/scripts/state/app-state.js");
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith: (promise) => (responsePromise = promise),
    });
    const response = await responsePromise;

    expect(await response.text()).toBe("current module");
    expect(currentCache.match).toHaveBeenCalledWith(request, { ignoreSearch: true });
    expect(oldCacheLookup).not.toHaveBeenCalled();
  });

  it("fetches a newer versioned asset instead of serving the active worker's old copy", async () => {
    const listeners = new Map();
    const cache = {
      match: vi.fn(async () => new Response("old stylesheet")),
      put: vi.fn(async () => {}),
    };
    const networkFetch = vi.fn(async () => new Response("new stylesheet"));
    runInNewContext(serviceWorkerSource, {
      self: {
        addEventListener: (event, handler) => listeners.set(event, handler),
        location: { origin: "https://sunshineoptimist.com" },
      },
      caches: { open: async () => cache },
      fetch: networkFetch,
      Request,
      URL,
      console,
    });

    const request = new Request("https://sunshineoptimist.com/styles.css?v=v999-next");
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith: (promise) => (responsePromise = promise),
    });

    expect(await (await responsePromise).text()).toBe("new stylesheet");
    expect(cache.match).not.toHaveBeenCalled();
    expect(networkFetch).toHaveBeenCalledWith(request);
  });
});
