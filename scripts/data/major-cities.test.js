import { describe, it, expect } from "vitest";
import { MAJOR_CITIES } from "./major-cities.js";

describe("MAJOR_CITIES data", () => {
  it("has exactly 100 cities", () => {
    expect(MAJOR_CITIES).toHaveLength(100);
  });

  it("every city has all required fields", () => {
    const requiredFields = [
      "name",
      "admin1",
      "admin2",
      "country",
      "country_code",
      "latitude",
      "longitude",
      "elevation",
      "timezone",
    ];

    for (const city of MAJOR_CITIES) {
      for (const field of requiredFields) {
        expect(city).toHaveProperty(field);
      }
    }
  });

  it("every city has a valid IANA timezone", () => {
    for (const city of MAJOR_CITIES) {
      expect(() => {
        Intl.DateTimeFormat(undefined, { timeZone: city.timezone });
      }).not.toThrow();
    }
  });

  it("every city has latitude within valid range", () => {
    for (const city of MAJOR_CITIES) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
    }
  });

  it("every city has longitude within valid range", () => {
    for (const city of MAJOR_CITIES) {
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
    }
  });

  it("every city has a 2-letter country code", () => {
    for (const city of MAJOR_CITIES) {
      expect(city.country_code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("every city has a non-empty name", () => {
    for (const city of MAJOR_CITIES) {
      expect(city.name.length).toBeGreaterThan(0);
    }
  });
});
