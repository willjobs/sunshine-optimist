// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  buildShareProgressLine,
  flashActionLabel,
  getShareMode,
  setShareMode,
} from "./share-modal-ui.js";

describe("share-modal-ui", () => {
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

  it("flashes button labels and restores text", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    button.className = "share-copy-button";
    button.textContent = "Copy to clipboard";

    flashActionLabel(button, "Copied!");
    expect(button.textContent).toBe("Copied!");

    vi.advanceTimersByTime(1200);
    expect(button.textContent).toBe("Copy to clipboard");
    vi.useRealTimers();
  });

  it("manages share mode state", () => {
    // Default mode is "text"
    setShareMode("text");
    expect(getShareMode()).toBe("text");

    // Switch to story mode
    setShareMode("story");
    expect(getShareMode()).toBe("story");

    // Switch back to text mode
    setShareMode("text");
    expect(getShareMode()).toBe("text");

    // Invalid mode defaults to text
    setShareMode("invalid");
    expect(getShareMode()).toBe("text");

    setShareMode(null);
    expect(getShareMode()).toBe("text");

    setShareMode(undefined);
    expect(getShareMode()).toBe("text");
  });
});
