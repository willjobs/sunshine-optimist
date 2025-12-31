import { describe, it, expect, vi, afterEach } from "vitest";
import { searchCities, fetchDefaultLocationData } from "./geocoding-service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocoding-service", () => {
  it("searches cities and maps results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: "San Jose",
            admin1: "California",
            admin2: "",
            country: "United States",
            country_code: "US",
            latitude: 37.3382,
            longitude: -121.8863,
            elevation: 0,
            timezone: "America/Los_Angeles",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchCities("San Jose", "en");
    expect(fetchMock.mock.calls[0][0]).toContain("name=San%20Jose");
    expect(results[0]).toMatchObject({
      name: "San Jose",
      country_code: "US",
      timezone: "America/Los_Angeles",
    });
  });

  it("selects the best Boston match as default location", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { name: "Boston", country_code: "US", admin1: "California" },
          { name: "Boston", country_code: "US", admin1: "Massachusetts" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDefaultLocationData("en");
    expect(result?.admin1).toBe("Massachusetts");
  });
});
