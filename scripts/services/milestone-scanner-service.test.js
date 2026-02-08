import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock astronomy-utils before importing the service
vi.mock("../utils/astronomy-utils.js", () => ({
  createAstronomyContext: vi.fn(),
}));

// Mock major-cities to use a small test set
vi.mock("../data/major-cities.js", () => ({
  MAJOR_CITIES: Array.from({ length: 10 }, (_, i) => ({
    name: `City ${i}`,
    admin1: "",
    admin2: "",
    country: "Test",
    country_code: "TS",
    latitude: 40 + i,
    longitude: -74,
    elevation: 0,
    timezone: "America/New_York",
  })),
}));

import { hasMilestoneToday, scanCitiesForMilestones } from "./milestone-scanner-service.js";
import { createAstronomyContext } from "../utils/astronomy-utils.js";

const TODAY = { year: 2026, month: 2, day: 15 };
const WINTER_SOLSTICE = { year: 2025, month: 12, day: 21 };

const mockGetDateParts = () => TODAY;

const buildMockAstronomy = ({
  sunsetMatch = null,
  daylightMatch = null,
  gainMatch = null,
} = {}) => ({
  getPreviousSeasonDateParts: () => WINTER_SOLSTICE,
  findFirstSunsetAfter: () => sunsetMatch,
  findFirstDaylightAtLeast: () => daylightMatch,
  findFirstDaylightGain: () => gainMatch,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasMilestoneToday", () => {
  const city = {
    name: "Test City",
    latitude: 40.7,
    longitude: -74,
    elevation: 0,
    timezone: "America/New_York",
  };

  it("returns null when no milestones match today", () => {
    createAstronomyContext.mockReturnValue(buildMockAstronomy());
    expect(hasMilestoneToday(city, mockGetDateParts)).toBeNull();
  });

  it("returns a sunset threshold milestone matching today", () => {
    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ sunsetMatch: { dateParts: TODAY, offsetDays: 56 } })
    );
    const result = hasMilestoneToday(city, mockGetDateParts);
    expect(result).not.toBeNull();
    expect(result.city).toBe(city);
    expect(result.milestone.id).toBe("sunset-after-4");
  });

  it("returns a daylight duration milestone matching today", () => {
    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ daylightMatch: { dateParts: TODAY, offsetDays: 80 } })
    );
    const result = hasMilestoneToday(city, mockGetDateParts);
    expect(result).not.toBeNull();
    expect(result.milestone.id).toBe("first-10-hours");
  });

  it("returns a daylight gain milestone matching today", () => {
    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ gainMatch: { dateParts: TODAY, offsetDays: 45 } })
    );
    const result = hasMilestoneToday(city, mockGetDateParts);
    expect(result).not.toBeNull();
    expect(result.milestone.id).toBe("gain-30");
  });

  it("does not match milestones on a different day", () => {
    const otherDay = { year: 2026, month: 2, day: 20 };
    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ sunsetMatch: { dateParts: otherDay, offsetDays: 61 } })
    );
    expect(hasMilestoneToday(city, mockGetDateParts)).toBeNull();
  });

  it("returns null when getPreviousSeasonDateParts returns null", () => {
    createAstronomyContext.mockReturnValue({
      ...buildMockAstronomy(),
      getPreviousSeasonDateParts: () => null,
    });
    expect(hasMilestoneToday(city, mockGetDateParts)).toBeNull();
  });
});

describe("scanCitiesForMilestones", () => {
  it("returns empty array when no cities have milestones", async () => {
    createAstronomyContext.mockReturnValue(buildMockAstronomy());
    const results = await scanCitiesForMilestones(mockGetDateParts);
    expect(results).toEqual([]);
  });

  it("collects cities with milestones", async () => {
    let callCount = 0;
    createAstronomyContext.mockImplementation(() => {
      callCount += 1;
      // Make every 3rd city have a milestone
      if (callCount % 3 === 0) {
        return buildMockAstronomy({ sunsetMatch: { dateParts: TODAY, offsetDays: 56 } });
      }
      return buildMockAstronomy();
    });

    const results = await scanCitiesForMilestones(mockGetDateParts);
    expect(results.length).toBe(3); // cities 2, 5, 8 (0-indexed)
  });

  it("stops at 5 results", async () => {
    // All cities match
    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ sunsetMatch: { dateParts: TODAY, offsetDays: 56 } })
    );
    const results = await scanCitiesForMilestones(mockGetDateParts);
    expect(results.length).toBe(5);
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    createAstronomyContext.mockReturnValue(
      buildMockAstronomy({ sunsetMatch: { dateParts: TODAY, offsetDays: 56 } })
    );
    const results = await scanCitiesForMilestones(mockGetDateParts, controller.signal);
    expect(results).toEqual([]);
  });
});
