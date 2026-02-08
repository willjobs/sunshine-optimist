// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPolarNightCopy,
  OPTIMISTIC_POLAR_DAY_COPY,
  startOptimisticRotation,
  stopOptimisticRotation,
} from "./message-ui.js";
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

const buildControls = () => {
  const container = document.createElement("div");
  const dots = document.createElement("div");
  const prevButton = document.createElement("button");
  const nextButton = document.createElement("button");
  container.append(prevButton, nextButton, dots);
  return { container, dots, prevButton, nextButton };
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
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);
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

  it("advances via nav buttons and updates dots", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);
    const { headline, lede } = buildNodes();
    const controls = buildControls();
    const messages = [
      { headline: "First headline", lede: "First lede" },
      { headline: "Second headline", lede: "Second lede" },
    ];
    startOptimisticRotation(headline, lede, messages, controls);
    const dots = controls.dots.querySelectorAll(".optimistic-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0].classList.contains("is-active")).toBe(true);

    controls.nextButton.click();
    expect(getOptimisticIndex()).toBe(1);
    vi.advanceTimersByTime(400);
    expect(headline.textContent).toBe("Second headline");
    const updatedDots = controls.dots.querySelectorAll(".optimistic-dot");
    expect(updatedDots[1].classList.contains("is-active")).toBe(true);
    randomSpy.mockRestore();
  });

  it("jumps to message when dot is clicked", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { headline, lede } = buildNodes();
    const controls = buildControls();
    const messages = [
      { headline: "First headline", lede: "First lede" },
      { headline: "Second headline", lede: "Second lede" },
      { headline: "Third headline", lede: "Third lede" },
    ];
    startOptimisticRotation(headline, lede, messages, controls);
    expect(getOptimisticIndex()).toBe(0);

    const dots = controls.dots.querySelectorAll(".optimistic-dot");
    expect(dots).toHaveLength(3);

    dots[2].click();
    expect(getOptimisticIndex()).toBe(2);
    vi.advanceTimersByTime(400);
    expect(headline.textContent).toBe("Third headline");
    expect(lede.textContent).toBe("Third lede");

    const updatedDots = controls.dots.querySelectorAll(".optimistic-dot");
    expect(updatedDots[2].classList.contains("is-active")).toBe(true);
    expect(updatedDots[0].classList.contains("is-active")).toBe(false);
    expect(updatedDots[1].classList.contains("is-active")).toBe(false);
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

  it("provides polar day messaging", () => {
    expect(OPTIMISTIC_POLAR_DAY_COPY).toEqual({
      headline: "Enjoy the 24 hours of daylight.",
      lede: "Remember to wear sunscreen!",
    });
  });

  it("builds polar night messaging with a countdown", () => {
    expect(createPolarNightCopy(3)).toEqual({
      headline: "Sunlight will return in 3 days.",
      lede: "This isn't forever.",
    });
  });

  it("builds polar night messaging without a countdown", () => {
    expect(createPolarNightCopy(null)).toEqual({
      headline: "The sun will return soon.",
      lede: "This isn't forever.",
    });
  });
});
