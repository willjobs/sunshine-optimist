// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { buildShareProgressLine, flashActionLabel } from "./share-modal-ui.js";
import { getShareMode, setShareMode } from "../state/app-state.js";

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
});
