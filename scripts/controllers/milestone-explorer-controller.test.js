// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scanCitiesForMilestones } from "../services/milestone-scanner-service.js";
import { initMilestoneExplorer, toggleMilestoneExplorer } from "./milestone-explorer-controller.js";

vi.mock("../services/milestone-scanner-service.js", () => ({
  scanCitiesForMilestones: vi.fn(),
}));

const buildDom = () => {
  const toggle = document.createElement("button");
  const panel = document.createElement("div");
  const status = document.createElement("p");
  const results = document.createElement("ul");
  panel.hidden = true;
  return { toggle, panel, status, results };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("milestone explorer", () => {
  it("shows named city milestones and selects a city without changing the search field", async () => {
    const dom = buildDom();
    const city = { name: "Paris", admin1: "Île-de-France", country: "France" };
    const onSelectCity = vi.fn();
    scanCitiesForMilestones.mockResolvedValue([
      { city, milestone: { title: "First sunset after 6pm" } },
    ]);
    initMilestoneExplorer(dom, { getDateParts: vi.fn(), onSelectCity });

    await toggleMilestoneExplorer();

    expect(dom.panel.hidden).toBe(false);
    expect(dom.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(dom.status.textContent).toMatch(/1 city with a milestone/i);
    expect(dom.results.textContent).toContain("Paris");
    expect(dom.results.textContent).toContain("First sunset after 6pm");

    dom.results.querySelector("button").click();
    expect(onSelectCity).toHaveBeenCalledWith(city);
    expect(dom.panel.hidden).toBe(true);
  });

  it("cancels an in-progress scan when closed", async () => {
    const dom = buildDom();
    scanCitiesForMilestones.mockImplementation(() => new Promise(() => {}));
    initMilestoneExplorer(dom, { getDateParts: vi.fn(), onSelectCity: vi.fn() });

    void toggleMilestoneExplorer();
    const signal = scanCitiesForMilestones.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    await toggleMilestoneExplorer();

    expect(signal.aborted).toBe(true);
    expect(dom.panel.hidden).toBe(true);
  });

  it("shows an empty state when no checked city has a milestone", async () => {
    const dom = buildDom();
    scanCitiesForMilestones.mockResolvedValue([]);
    initMilestoneExplorer(dom, { getDateParts: vi.fn(), onSelectCity: vi.fn() });

    await toggleMilestoneExplorer();

    expect(dom.status.textContent).toBe("No milestones found in the cities checked.");
    expect(dom.results.children).toHaveLength(0);
  });
});
