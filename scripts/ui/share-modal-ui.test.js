// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";

const { fetchReverseGeocodeLocationMock, generateStoryCanvasMock } = vi.hoisted(() => ({
  fetchReverseGeocodeLocationMock: vi.fn(),
  generateStoryCanvasMock: vi.fn(),
}));

vi.mock("../services/reverse-geocode-service.js", () => ({
  fetchReverseGeocodeLocation: fetchReverseGeocodeLocationMock,
}));

vi.mock("./story-image-ui.js", () => ({
  generateStoryCanvas: generateStoryCanvasMock,
}));

import {
  _resetSharePreviewGenerations,
  buildShareProgressLine,
  flashActionLabel,
  refreshSharePreview,
  refreshStoryPreview,
} from "./share-modal-ui.js";
import {
  getLastGeneratedCanvas,
  getShareMode,
  getShareText,
  setActiveLocation,
  setLastGeneratedCanvas,
  setModalSnapshot,
  setShareMode,
  setSharePrivacyEnabled,
  setShareSnapshot,
  setShareText,
} from "../state/app-state.js";

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const buildCurrentLocation = () => ({
  name: "Current Location",
  isCurrent: true,
  latitude: 47.6062,
  longitude: -122.3321,
  timezone: "America/Los_Angeles",
  country: "United States",
  country_code: "US",
});

const buildShareSnapshot = () => ({
  location: buildCurrentLocation(),
  timeZone: "America/Los_Angeles",
  dateParts: { year: 2026, month: 2, day: 8 },
  todayDaylight: 600,
  sunsetEarliestDelta: 45,
});

describe("share-modal-ui", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSharePreviewGenerations();
    setShareSnapshot(null);
    setModalSnapshot(null);
    setSharePrivacyEnabled(false);
    setShareText("");
    setShareMode("story");
    setActiveLocation(null);
    setLastGeneratedCanvas(null);
    fetchReverseGeocodeLocationMock.mockResolvedValue(null);
    generateStoryCanvasMock.mockImplementation(async (_headline, locationLabel) => ({
      toDataURL: () => `data:image/png;base64,${String(locationLabel || "").replace(/\s+/g, "-")}`,
    }));
  });

  it("builds progress lines for max and shortest modes", () => {
    const maxLine = buildShareProgressLine({
      daylightGainToday: 5,
      todayDaylight: 600,
      longestDayMinutes: 800,
      shortestDayMinutes: 400,
    });
    const maxParts = maxLine.split(" ");
    expect(maxParts[0].length).toBe(20);
    expect(maxLine).toContain("maximum daylight");

    const shortestLine = buildShareProgressLine({
      daylightGainToday: -5,
      fractionOfLossCompleted: 0.25,
      dateParts: { month: 11 },
      hemisphere: "north",
      todayDaylight: 600,
      longestDayMinutes: 800,
      shortestDayMinutes: 400,
    });
    expect(shortestLine).toContain("Progress towards shortest day");
    expect(shortestLine).toContain("25%");

    const noneLine = buildShareProgressLine({
      daylightGainToday: -5,
      dateParts: { month: 7 },
      hemisphere: "north",
      todayDaylight: 600,
      longestDayMinutes: 800,
      shortestDayMinutes: 400,
    });
    expect(noneLine).toBe("");
  });

  it("flashes copy feedback and hides it again", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    button.className = "share-copy-button";
    const feedback = document.createElement("span");
    feedback.className = "share-copy-feedback";
    feedback.hidden = true;

    flashActionLabel(button, "Copied to clipboard!", feedback);
    expect(feedback.hidden).toBe(false);
    expect(feedback.classList.contains("is-visible")).toBe(true);
    expect(button.classList.contains("is-flash")).toBe(true);
    expect(feedback.textContent).toBe("Copied to clipboard!");

    vi.advanceTimersByTime(1200);
    expect(feedback.classList.contains("is-visible")).toBe(false);
    expect(button.classList.contains("is-flash")).toBe(false);

    vi.advanceTimersByTime(200);
    expect(feedback.hidden).toBe(true);
    vi.useRealTimers();
  });

  it("manages share mode state", () => {
    setShareMode("story");
    expect(getShareMode()).toBe("story");

    // Switch back to text mode
    setShareMode("text");
    expect(getShareMode()).toBe("text");

    // Switch back to story mode
    setShareMode("story");
    expect(getShareMode()).toBe("story");

    // Invalid mode defaults to story
    setShareMode("invalid");
    expect(getShareMode()).toBe("story");

    setShareMode(null);
    expect(getShareMode()).toBe("story");

    setShareMode(undefined);
    expect(getShareMode()).toBe("story");
  });

  it("keeps latest text preview when privacy toggles during async refresh", async () => {
    const snapshot = buildShareSnapshot();
    setShareSnapshot(snapshot);
    setModalSnapshot(snapshot);
    setSharePrivacyEnabled(false);

    const sharePreview = document.createElement("pre");
    const headline = document.createElement("h2");
    const lede = document.createElement("p");
    headline.textContent = "Longer days ahead";
    lede.textContent = "You made it.";

    const deferred = createDeferred();
    fetchReverseGeocodeLocationMock.mockReturnValueOnce(deferred.promise);

    const firstRefresh = refreshSharePreview(
      sharePreview,
      headline,
      lede,
      () => snapshot.dateParts,
      "en",
      snapshot.timeZone
    );

    setSharePrivacyEnabled(true);
    await refreshSharePreview(
      sharePreview,
      headline,
      lede,
      () => snapshot.dateParts,
      "en",
      snapshot.timeZone
    );

    expect(getShareText()).toContain("My Location");
    expect(sharePreview.textContent).toContain("My Location");

    deferred.resolve({
      name: "Seattle",
      admin1: "Washington",
      country: "United States",
      country_code: "US",
      latitude: 47.6062,
      longitude: -122.3321,
      timezone: "America/Los_Angeles",
    });
    await firstRefresh;

    expect(sharePreview.textContent).toContain("My Location");
    expect(sharePreview.textContent).not.toContain("Seattle");
    expect(getShareText()).toContain("My Location");
    expect(getShareText()).not.toContain("Seattle");
  });

  it("keeps latest story preview when privacy toggles during async refresh", async () => {
    const snapshot = buildShareSnapshot();
    setShareSnapshot(snapshot);
    setModalSnapshot(snapshot);
    setSharePrivacyEnabled(false);

    const headline = document.createElement("h2");
    headline.textContent = "Longer days ahead";
    const storyImage = document.createElement("img");

    const deferred = createDeferred();
    fetchReverseGeocodeLocationMock.mockReturnValueOnce(deferred.promise);

    const privateCanvas = { toDataURL: () => "data:image/png;base64,private" };
    const staleCanvas = { toDataURL: () => "data:image/png;base64,stale" };
    generateStoryCanvasMock.mockResolvedValueOnce(privateCanvas).mockResolvedValueOnce(staleCanvas);

    const firstRefresh = refreshStoryPreview(storyImage, headline, null, "en");

    setSharePrivacyEnabled(true);
    await refreshStoryPreview(storyImage, headline, null, "en");

    expect(getLastGeneratedCanvas()).toBe(privateCanvas);
    expect(storyImage.src).toContain("private");

    deferred.resolve({
      name: "Seattle",
      admin1: "Washington",
      country: "United States",
      country_code: "US",
      latitude: 47.6062,
      longitude: -122.3321,
      timezone: "America/Los_Angeles",
    });
    await firstRefresh;

    expect(generateStoryCanvasMock).toHaveBeenCalledTimes(2);
    expect(generateStoryCanvasMock.mock.calls[0][1]).toBe("My Location");
    expect(generateStoryCanvasMock.mock.calls[1][1]).toContain("Seattle");
    expect(getLastGeneratedCanvas()).toBe(privateCanvas);
    expect(storyImage.src).toContain("private");
    expect(storyImage.src).not.toContain("stale");
  });
});
