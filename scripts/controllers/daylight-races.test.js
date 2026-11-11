// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const { pendingScans } = vi.hoisted(() => ({ pendingScans: [] }));
vi.mock("../utils/astronomy-utils.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    createAstronomyContext: (...args) => {
      const context = original.createAstronomyContext(...args);
      const calculate = context.getYearlySunExtremesAsync;
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      pendingScans.push(release);
      context.getYearlySunExtremesAsync = async (...params) => {
        await gate;
        return calculate(...params);
      };
      return context;
    },
  };
});
import { updateDaylightForLocation, _resetUpdateGeneration } from "./daylight-controller.js";
import { getShareSnapshot, setShareSnapshot } from "../state/app-state.js";
import { stopOptimisticRotation } from "../ui/message-ui.js";
import { createDateFormatter } from "../utils/date-utils.js";
beforeAll(async () => {
  const module = await import("../../astronomy-engine/astronomy.browser.js");
  if (!globalThis.Astronomy && module.default) globalThis.Astronomy = module.default;
});
afterEach(() => {
  stopOptimisticRotation();
  pendingScans.length = 0;
});
describe("daylight sharing readiness", () => {
  it("keeps sharing unavailable until the newest complete result, even when an older scan finishes later", async () => {
    _resetUpdateGeneration();
    setShareSnapshot({ dateParts: { year: 2026, month: 11, day: 10 } });
    const dom = {
      shareButton: document.createElement("button"),
      headline: document.createElement("h2"),
      lede: document.createElement("p"),
    };
    const render = vi.fn(({ data }) => {
      dom.headline.textContent = String(data.daylight_today);
    });
    const update = (parts) =>
      updateDaylightForLocation({
        location: { latitude: 42.3601, longitude: -71.0589, timezone: "America/New_York" },
        dom,
        getActiveDateParts: () => parts,
        syncDatePicker: vi.fn(),
        updateOptimisticMessage: render,
        formatters: createDateFormatter("en-US"),
        fallbackTimeZone: "UTC",
      });
    const old = update({ year: 2029, month: 6, day: 1 });
    expect(dom.shareButton.disabled).toBe(true);
    expect(getShareSnapshot()).toBe(null);
    const latestDate = { year: 2030, month: 4, day: 15 };
    const latest = update(latestDate);
    pendingScans[1]();
    await latest;
    expect(dom.shareButton.disabled).toBe(false);
    expect(getShareSnapshot().dateParts).toEqual(latestDate);
    expect(render).toHaveBeenCalledTimes(1);
    const headline = dom.headline.textContent;
    pendingScans[0]();
    await old;
    expect(dom.shareButton.disabled).toBe(false);
    expect(getShareSnapshot().dateParts).toEqual(latestDate);
    expect(dom.headline.textContent).toBe(headline);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
