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
  buildShareMessage,
  captureShareSnapshot,
  closeShareModal,
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
  setUpcomingMilestones,
  setMilestoneIndex,
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

  it("does not round unfinished annual loss progress to 100%", () => {
    const line = buildShareProgressLine({
      daylightGainToday: -0.1,
      fractionOfLossCompleted: 0.99987,
      dateParts: { month: 12 },
      hemisphere: "north",
    });
    expect(line).toContain("99%");
    expect(line).not.toContain("100%");
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
      fractionOfLossCompleted: 0.75,
      dateParts: { month: 11 },
      hemisphere: "north",
      todayDaylight: 600,
      longestDayMinutes: 800,
      shortestDayMinutes: 400,
    });
    expect(shortestLine).toContain("of the annual daylight decrease is behind you");
    expect(shortestLine).toContain("75%");

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

  it.each([
    ["polar-day", "24 hours"],
    ["polar-night", "0 hours"],
  ])("builds truthful share text for %s", async (polarState, expectedDaylight) => {
    const snapshot = {
      ...buildShareSnapshot(),
      location: {
        name: "Tromsø",
        admin1: "",
        country: "Norway",
        country_code: "NO",
        latitude: 69.6492,
        longitude: 18.9553,
        timezone: "Europe/Oslo",
      },
      todayDaylight: null,
      sunsetEarliestDelta: null,
      polarState,
    };
    setShareSnapshot(snapshot);

    const message = await buildShareMessage(
      document.createElement("h2"),
      document.createElement("p"),
      () => snapshot.dateParts,
      "en",
      snapshot.timeZone
    );

    expect(message).toContain(`☀️ ${expectedDaylight} of daylight today`);
    expect(message).not.toContain("Sunset");
    expect(message).not.toContain("NaN");
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
    generateStoryCanvasMock.mockResolvedValueOnce(privateCanvas);

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

    expect(generateStoryCanvasMock).toHaveBeenCalledTimes(1);
    expect(generateStoryCanvasMock.mock.calls[0][1]).toBe("My Location");
    expect(getLastGeneratedCanvas()).toBe(privateCanvas);
    expect(storyImage.src).toContain("private");
    expect(storyImage.src).not.toContain("stale");
  });
});

describe("share snapshot and preview lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetSharePreviewGenerations();
    setSharePrivacyEnabled(false);
    setModalSnapshot(null);
    setShareSnapshot(buildShareSnapshot());
    setLastGeneratedCanvas(null);
    setUpcomingMilestones([]);
    setMilestoneIndex(0);
    document.body.innerHTML =
      '<dialog id="share-modal"></dialog><img id="share-story-image" src="data:image/png;base64,old"><button id="share-download-button"></button><button data-share="web-story"></button>';
  });
  it("freezes the selected milestone before an async location lookup", async () => {
    const deferred = createDeferred();
    fetchReverseGeocodeLocationMock.mockReturnValueOnce(deferred.promise);
    setUpcomingMilestones([{ title: "Sunsets get later", offsetDays: 5 }]);
    const headline = document.createElement("h2");
    headline.textContent = "Frozen headline";
    captureShareSnapshot(headline, null);
    const pending = buildShareMessage(headline, null, () => ({}), "en", "UTC");
    setUpcomingMilestones([{ title: "Sunrises get earlier", offsetDays: 3 }]);
    setShareSnapshot({ ...buildShareSnapshot(), dateParts: { year: 2030, month: 1, day: 1 } });
    headline.textContent = "New headline";
    deferred.resolve(null);
    const message = await pending;
    expect(message).toContain("Frozen headline");
    expect(message).toContain("sunsets get later");
    expect(message).not.toContain("sunrises get earlier");
    expect(message).not.toContain("2030");
  });
  it("clears old exports while pending and prevents a closed preview from publishing", async () => {
    const canvas = { toDataURL: () => "data:image/png;base64,new" };
    setLastGeneratedCanvas(canvas);
    const deferred = createDeferred();
    fetchReverseGeocodeLocationMock.mockReturnValueOnce(deferred.promise);
    const image = document.getElementById("share-story-image");
    const pending = refreshStoryPreview(image, null, null, "en");
    expect(getLastGeneratedCanvas()).toBe(null);
    expect(image.hasAttribute("src")).toBe(false);
    expect(image.hidden).toBe(true);
    expect(document.getElementById("share-download-button").disabled).toBe(true);
    expect(document.querySelector('[data-share="web-story"]').disabled).toBe(true);
    closeShareModal(document.getElementById("share-modal"));
    deferred.resolve(null);
    await pending;
    expect(getLastGeneratedCanvas()).toBe(null);
    expect(generateStoryCanvasMock).not.toHaveBeenCalled();
  });
  it("keeps failed generation exports disabled and enables a completed preview", async () => {
    fetchReverseGeocodeLocationMock.mockResolvedValue(null);
    generateStoryCanvasMock.mockRejectedValueOnce(new Error("canvas failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const image = document.getElementById("share-story-image");
    await refreshStoryPreview(image, null, null, "en");
    expect(getLastGeneratedCanvas()).toBe(null);
    expect(document.getElementById("share-download-button").disabled).toBe(true);
    const canvas = { toDataURL: () => "data:image/png;base64,new" };
    generateStoryCanvasMock.mockResolvedValueOnce(canvas);
    await refreshStoryPreview(image, null, null, "en");
    expect(getLastGeneratedCanvas()).toBe(canvas);
    expect(image.src).toContain("base64,new");
    expect(document.getElementById("share-download-button").disabled).toBe(false);
    warn.mockRestore();
  });
});
