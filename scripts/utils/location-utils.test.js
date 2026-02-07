import { describe, it, expect } from "vitest";
import {
  formatSelectedLocation,
  formatSuggestionLocation,
  parseQuery,
  applyFilterTokens,
  isNameMatch,
  distanceKm,
  sortByDistance,
} from "./location-utils.js";

describe("location-utils", () => {
  it("formats selected and suggestion locations", () => {
    const boston = {
      name: "Boston",
      admin1: "Massachusetts",
      country: "United States",
      country_code: "US",
    };
    expect(formatSelectedLocation(boston)).toBe("Boston, MA");
    expect(formatSuggestionLocation(boston)).toBe("Boston, MA");

    const paris = {
      name: "Paris",
      admin1: "Ile-de-France",
      country: "France",
      country_code: "FR",
    };
    expect(formatSelectedLocation(paris)).toBe("Paris, France");
    expect(formatSuggestionLocation(paris)).toBe("Paris, France");
  });

  it("parses queries and expands filter tokens", () => {
    const withComma = parseQuery("Paris, TX");
    expect(withComma.nameQuery).toBe("Paris");
    expect(withComma.filterTokens).toContain("tx");
    expect(withComma.filterTokens).toContain("texas");

    const withSuffix = parseQuery("Portland OR");
    expect(withSuffix.nameQuery).toBe("Portland");
    expect(withSuffix.filterTokens).toContain("or");
    expect(withSuffix.filterTokens).toContain("oregon");
  });

  it("applies filter tokens and name matching", () => {
    const items = [
      {
        name: "Paris",
        admin1: "Texas",
        admin2: "",
        country: "United States",
        country_code: "US",
      },
      {
        name: "Paris",
        admin1: "Ile-de-France",
        admin2: "",
        country: "France",
        country_code: "FR",
      },
    ];

    const filtered = applyFilterTokens(items, ["tx"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].country_code).toBe("US");

    expect(isNameMatch(items[0], "Pa")).toBe(true);
    expect(isNameMatch(items[0], "X")).toBe(false);
  });

  it("calculates distance and sorts by proximity", () => {
    const distance = distanceKm(47.6, -122.3, 47.6, -122.3);
    expect(distance).toBeCloseTo(0, 5);

    const items = [
      { name: "Near", latitude: 47.6, longitude: -122.3 },
      { name: "Far", latitude: 40.7, longitude: -74.0 },
    ];
    const sorted = sortByDistance(items, { lat: 47.6, lon: -122.3 });
    expect(sorted[0].name).toBe("Near");
  });
});
