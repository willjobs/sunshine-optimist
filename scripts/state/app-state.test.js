import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getPreferLocalResults,
  setPreferLocalResults,
  togglePreferLocalResults,
  setUserCoords,
  setReverseGeocodeCache,
  setReverseGeocodePromise,
  getReverseGeocodeCache,
  getReverseGeocodePromise,
  clearReverseGeocodeCache,
  setFetchController,
  setDebounceId,
  getFetchController,
  getDebounceId,
  resetLocationSearchState,
  batchStateUpdates,
  scheduleAfterBatch,
  getShareMode,
  setShareMode,
  getLastGeneratedCanvas,
  setLastGeneratedCanvas,
} from "./app-state.js";

afterEach(() => {
  setPreferLocalResults(true);
  setUserCoords(null);
  clearReverseGeocodeCache();
});

describe("app-state", () => {
  it("toggles preferLocalResults", () => {
    setPreferLocalResults(true);
    togglePreferLocalResults();
    expect(getPreferLocalResults()).toBe(false);
    togglePreferLocalResults();
    expect(getPreferLocalResults()).toBe(true);
  });

  it("clears reverse geocode cache when user coords change", () => {
    const cacheKey = "1,1";
    setReverseGeocodeCache(cacheKey, { name: "Cached" });
    setReverseGeocodePromise(cacheKey, Promise.resolve(null));

    setUserCoords({ lat: 1, lon: 1 });
    expect(getReverseGeocodeCache(cacheKey)).toBe(null);
    expect(getReverseGeocodePromise(cacheKey)).toBe(null);
  });

  it("resets location search state", () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    setFetchController(controller);
    setDebounceId(setTimeout(() => {}, 1000));

    resetLocationSearchState();
    expect(getFetchController()).toBe(null);
    expect(getDebounceId()).toBe(null);
    expect(controller.signal.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("batches state updates and schedules callbacks", () => {
    const calls = [];
    batchStateUpdates(() => {
      calls.push("during");
      scheduleAfterBatch(() => calls.push("after"));
    });
    expect(calls).toEqual(["during", "after"]);
  });

  it("manages share mode state", () => {
    expect(getShareMode()).toBe("story");
    setShareMode("text");
    expect(getShareMode()).toBe("text");
    setShareMode("invalid");
    expect(getShareMode()).toBe("story");
    setShareMode("story");
  });

  it("manages last generated canvas state", () => {
    expect(getLastGeneratedCanvas()).toBe(null);
    const fakeCanvas = { toDataURL: () => "" };
    setLastGeneratedCanvas(fakeCanvas);
    expect(getLastGeneratedCanvas()).toBe(fakeCanvas);
    setLastGeneratedCanvas(null);
    expect(getLastGeneratedCanvas()).toBe(null);
  });
});
