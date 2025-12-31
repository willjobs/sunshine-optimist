import { describe, it, expect } from "vitest";
import { clampValue } from "./utils.js";

describe("utils", () => {
  it("clamps values to a range", () => {
    expect(clampValue(5, 0, 10)).toBe(5);
    expect(clampValue(-1, 0, 10)).toBe(0);
    expect(clampValue(11, 0, 10)).toBe(10);
  });
});
