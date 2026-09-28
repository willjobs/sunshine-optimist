// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadRecentLocations,
  saveRecentLocations,
  loadStoredLocation,
  saveStoredLocation,
  loadSharePrivacyPreference,
  saveSharePrivacyPreference,
} from "./storage-service.js";

beforeEach(() => {
  window.localStorage.clear();
});

describe("storage-service", () => {
  it("saves and loads recent locations", () => {
    const items = [{ name: "Boston", latitude: 1, longitude: 2 }];
    saveRecentLocations(items);
    expect(loadRecentLocations()).toEqual(items);
  });

  it("returns empty list for invalid recent locations JSON", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem("sunshine-optimist:recent-locations", "{bad json}");
    expect(loadRecentLocations()).toEqual([]);
    vi.restoreAllMocks();
  });

  it("saves and loads stored location safely", () => {
    const location = {
      name: "Seattle",
      latitude: 1,
      longitude: 2,
      reverseGeocodeFailed: true,
    };
    saveStoredLocation(location);
    expect(loadStoredLocation()).toEqual({
      name: "Seattle",
      latitude: 1,
      longitude: 2,
    });
  });

  it("handles invalid stored location data", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem("sunshine-optimist:active-location", '"not object"');
    expect(loadStoredLocation()).toBe(null);
    vi.restoreAllMocks();
  });

  it("rejects an invalid stored timezone and removes that entry", () => {
    window.localStorage.setItem(
      "sunshine-optimist:active-location",
      JSON.stringify({
        name: "Broken City",
        latitude: 42,
        longitude: -71,
        timezone: "Invalid/Zone",
      })
    );

    expect(loadStoredLocation()).toBe(null);
    expect(window.localStorage.getItem("sunshine-optimist:active-location")).toBe(null);
  });

  it("discards malformed recent locations while keeping valid entries", () => {
    const valid = { name: "Seattle", latitude: 47.6062, longitude: -122.3321 };
    window.localStorage.setItem(
      "sunshine-optimist:recent-locations",
      JSON.stringify([valid, null, { name: "Bad", latitude: 120, longitude: 0 }])
    );

    expect(loadRecentLocations()).toEqual([valid]);
  });

  it("persists share privacy preference", () => {
    saveSharePrivacyPreference(true);
    expect(loadSharePrivacyPreference()).toBe(true);
  });
});
