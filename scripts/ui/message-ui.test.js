// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startOptimisticRotation, stopOptimisticRotation } from "./message-ui.js";
import {
  getOptimisticOptions,
  getOptimisticIndex,
  setOptimisticOptions,
  setOptimisticIndex,
} from "../state/app-state.js";

const buildNodes = () => {
  const headline = document.createElement("h1");
  const lede = document.createElement("p");
  return { headline, lede };
};

beforeEach(() => {
  setOptimisticOptions([]);
  setOptimisticIndex(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("message-ui", () => {
  it("starts rotation and sets initial copy", () => {
    const { headline, lede } = buildNodes();
    const messages = [{ headline: "First headline", lede: "First lede" }];
    startOptimisticRotation(headline, lede, messages);
    expect(headline.textContent).toBe("First headline");
    expect(lede.textContent).toBe("First lede");
    expect(getOptimisticOptions()).toHaveLength(1);
  });

  it("rotates through multiple messages", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const { headline, lede } = buildNodes();
    const messages = [
      { headline: "First headline", lede: "First lede" },
      { headline: "Second headline", lede: "Second lede" },
    ];
    startOptimisticRotation(headline, lede, messages);
    expect(getOptimisticIndex()).toBe(0);

    vi.advanceTimersByTime(15000 + 400);
    expect(headline.textContent).toBe("Second headline");
    expect(lede.textContent).toBe("Second lede");
    randomSpy.mockRestore();
  });

  it("stops rotation and clears options", () => {
    const { headline, lede } = buildNodes();
    const messages = [
      { headline: "First headline", lede: "First lede" },
      { headline: "Second headline", lede: "Second lede" },
    ];
    startOptimisticRotation(headline, lede, messages);
    stopOptimisticRotation(headline, lede);
    expect(getOptimisticOptions()).toHaveLength(0);
    expect(getOptimisticIndex()).toBe(0);
  });
});
