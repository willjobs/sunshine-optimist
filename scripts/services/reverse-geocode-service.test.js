// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchReverseGeocodeLocation } from "./reverse-geocode-service.js";
import {
  setReverseGeocodeCache,
  setReverseGeocodeCacheKey,
  setReverseGeocodePromise,
} from "../state/app-state.js";

beforeEach(() => {
  setReverseGeocodeCache(null);
  setReverseGeocodeCacheKey("");
  setReverseGeocodePromise(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reverse-geocode-service", () => {
  it("returns null for invalid coordinates", async () => {
    const result = await fetchReverseGeocodeLocation(null);
    expect(result).toBe(null);
  });

  it("caches reverse geocode responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        locality: "Test City",
        principalSubdivision: "Test State",
        countryName: "Testland",
        countryCode: "TL",
        latitude: 1,
        longitude: 2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const location = { latitude: 1, longitude: 2, timezone: "UTC" };
    const first = await fetchReverseGeocodeLocation(location, "en");
    const second = await fetchReverseGeocodeLocation(location, "en");

    expect(first?.name).toBe("Test City");
    expect(second?.name).toBe("Test City");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
