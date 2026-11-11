// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { preserveDateForUpdate, restoreDateAfterUpdate } from "./service-worker-service.js";
import {
  getCustomDateParts,
  isUsingLiveDate,
  setCustomDateParts,
  setUseLiveDate,
} from "../state/app-state.js";

beforeEach(() => {
  sessionStorage.clear();
  setUseLiveDate(true);
  setCustomDateParts(null);
});
afterEach(() => vi.restoreAllMocks());
describe("update date handoff", () => {
  it("restores a custom date exactly once", () => {
    const parts = { year: 2026, month: 12, day: 1 };
    setCustomDateParts(parts);
    setUseLiveDate(false);
    preserveDateForUpdate();
    setUseLiveDate(true);
    setCustomDateParts(null);
    restoreDateAfterUpdate();
    expect(isUsingLiveDate()).toBe(false);
    expect(getCustomDateParts()).toEqual(parts);
    setUseLiveDate(true);
    setCustomDateParts(null);
    restoreDateAfterUpdate();
    expect(isUsingLiveDate()).toBe(true);
  });
  it.each(["bad", "2026-02-30", "1800-01-01", "2101-01-01"])(
    "discards invalid handoff %s",
    (value) => {
      sessionStorage.setItem("sunshine-optimist:update-date", value);
      restoreDateAfterUpdate();
      expect(isUsingLiveDate()).toBe(true);
      expect(sessionStorage.length).toBe(0);
    }
  );
  it("keeps the live date live and removes an obsolete handoff", () => {
    sessionStorage.setItem("sunshine-optimist:update-date", "2026-12-01");
    preserveDateForUpdate();
    restoreDateAfterUpdate();
    expect(isUsingLiveDate()).toBe(true);
  });
  it("tolerates blocked session storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => {
      preserveDateForUpdate();
      restoreDateAfterUpdate();
    }).not.toThrow();
  });
});
