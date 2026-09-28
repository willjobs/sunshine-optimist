// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleInput, initLocationController } from "./location-controller.js";
import {
  getSuggestionResults,
  resetLocationSearchState,
  setFetchController,
  setSuggestionResults,
} from "../state/app-state.js";

const buildSearchDom = () => {
  const cityInput = document.createElement("input");
  const resultsPanel = document.createElement("div");
  const resultsList = document.createElement("div");
  const resultsMeta = document.createElement("div");
  const resultsActions = document.createElement("div");
  const clearButton = document.createElement("button");
  resultsPanel.classList.add("is-open");
  cityInput.setAttribute("aria-expanded", "true");
  resultsList.appendChild(document.createElement("div"));
  return { cityInput, resultsPanel, resultsList, resultsMeta, resultsActions, clearButton };
};

beforeEach(() => {
  vi.useFakeTimers();
  resetLocationSearchState();
});

afterEach(() => {
  resetLocationSearchState();
  vi.useRealTimers();
});

describe("location search", () => {
  it("drops old suggestions as soon as a new query is entered", () => {
    const dom = buildSearchDom();
    initLocationController(dom, { languageCode: "en", fallbackTimeZone: "UTC" });
    setSuggestionResults([{ name: "Paris", latitude: 1, longitude: 2 }]);
    const pendingFetch = new AbortController();
    setFetchController(pendingFetch);

    dom.cityInput.value = "Seattle";
    handleInput();

    expect(pendingFetch.signal.aborted).toBe(true);
    expect(getSuggestionResults()).toEqual([]);
    expect(dom.cityInput.getAttribute("aria-expanded")).toBe("false");
    expect(dom.resultsList.children).toHaveLength(0);
  });
});
