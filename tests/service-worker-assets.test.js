import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const serviceWorkerSource = readFileSync(resolve(projectRoot, "sw.js"), "utf8");

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
});
