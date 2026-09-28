// Node 26 exposes a native localStorage getter even without a storage file.
// Vitest keeps that global instead of installing jsdom's working storage.
if (globalThis.jsdom) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: globalThis.jsdom.window.localStorage,
  });
}
