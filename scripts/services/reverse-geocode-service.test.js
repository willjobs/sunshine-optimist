// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchReverseGeocodeLocation } from "./reverse-geocode-service.js";
import { clearReverseGeocodeCache } from "../state/app-state.js";

beforeEach(() => {
  clearReverseGeocodeCache();
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

  it("keeps concurrent requests isolated by coordinate key", async () => {
    let resolveFirstRequest;
    let resolveSecondRequest;

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = () =>
              resolve({
                ok: true,
                json: async () => ({
                  locality: "Location One",
                  principalSubdivision: "State One",
                  countryName: "Country One",
                  countryCode: "C1",
                  latitude: 1,
                  longitude: 1,
                }),
              });
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondRequest = () =>
              resolve({
                ok: true,
                json: async () => ({
                  locality: "Location Two",
                  principalSubdivision: "State Two",
                  countryName: "Country Two",
                  countryCode: "C2",
                  latitude: 2,
                  longitude: 2,
                }),
              });
          })
      );

    vi.stubGlobal("fetch", fetchMock);

    const locationOne = { latitude: 1, longitude: 1, timezone: "UTC" };
    const locationTwo = { latitude: 2, longitude: 2, timezone: "UTC" };

    const requestOne = fetchReverseGeocodeLocation(locationOne, "en");
    const requestTwo = fetchReverseGeocodeLocation(locationTwo, "en");

    resolveFirstRequest();
    const firstResult = await requestOne;

    const secondLocationWhilePending = fetchReverseGeocodeLocation(locationTwo, "en");

    resolveSecondRequest();
    const secondResult = await requestTwo;
    const secondResultRepeat = await secondLocationWhilePending;

    expect(firstResult?.name).toBe("Location One");
    expect(secondResult?.name).toBe("Location Two");
    expect(secondResultRepeat?.name).toBe("Location Two");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
