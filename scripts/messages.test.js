import { describe, it, expect } from "vitest";
import { getOptimisticMessageOptions } from "./messages.js";

describe("messages", () => {
  it("filters messages by month and fills placeholders", () => {
    const data = {
      sunset_today: 1000,
      sunset_earliest: 900,
    };

    const optionsNorth = getOptimisticMessageOptions(data, 1, "north");
    expect(optionsNorth).toHaveLength(1);
    expect(optionsNorth[0].headline).toContain("later than it was at its earliest");
    expect(optionsNorth[0].headline).not.toContain("{##");

    const optionsSouth = getOptimisticMessageOptions(data, 7, "south");
    expect(optionsSouth).toHaveLength(1);

    const optionsWrongMonth = getOptimisticMessageOptions(data, 6, "north");
    expect(optionsWrongMonth).toHaveLength(0);
  });

  it("excludes messages when requirements are not met", () => {
    const data = {
      sunset_today: 900,
      sunset_earliest: 900,
    };
    const options = getOptimisticMessageOptions(data, 1, "north");
    expect(options).toHaveLength(0);
  });
});
