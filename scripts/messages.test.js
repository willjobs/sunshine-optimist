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

  it("replaces empty lede with milestone countdown when milestones provided", () => {
    // This message has lede: null - "In two weeks, you'll have {## minutes} more daylight."
    const data = {
      daylight_today: 600,
      daylight_in_14_days: 650,
    };
    const upcomingMilestones = [
      { title: "Spring equinox", offsetDays: 15 },
      { title: "Longest day", offsetDays: 90 },
    ];

    const options = getOptimisticMessageOptions(data, 1, "north", upcomingMilestones);
    const messageWithNullLede = options.find((opt) =>
      opt.headline.includes("In two weeks, you'll have")
    );

    expect(messageWithNullLede).toBeDefined();
    expect(messageWithNullLede.lede).toBe("Only 15 days until spring equinox!");
  });

  it("uses singular 'day' for 1 day until milestone", () => {
    const data = {
      daylight_today: 600,
      daylight_in_14_days: 650,
    };
    const upcomingMilestones = [{ title: "Shortest day", offsetDays: 1 }];

    const options = getOptimisticMessageOptions(data, 1, "north", upcomingMilestones);
    const messageWithNullLede = options.find((opt) =>
      opt.headline.includes("In two weeks, you'll have")
    );

    expect(messageWithNullLede).toBeDefined();
    expect(messageWithNullLede.lede).toBe("Only 1 day until shortest day!");
  });

  it("keeps original lede when not empty", () => {
    const data = {
      sunset_today: 1000,
      sunset_earliest: 900,
    };
    const upcomingMilestones = [{ title: "Spring equinox", offsetDays: 15 }];

    const options = getOptimisticMessageOptions(data, 1, "north", upcomingMilestones);

    const sunsetMessage = options.find((opt) =>
      opt.headline.includes("later than it was at its earliest")
    );
    expect(sunsetMessage).toBeDefined();
    expect(sunsetMessage.lede).toBe("Enjoy the extra evening light!");
  });

  it("returns empty lede when no milestones and original lede is empty", () => {
    const data = {
      daylight_today: 600,
      daylight_in_14_days: 650,
    };

    const options = getOptimisticMessageOptions(data, 1, "north", []);
    const messageWithNullLede = options.find((opt) =>
      opt.headline.includes("In two weeks, you'll have")
    );

    expect(messageWithNullLede).toBeDefined();
    expect(messageWithNullLede.lede).toBe("");
  });

  it("includes milestone countdown as headline message", () => {
    const data = {};
    const upcomingMilestones = [
      { title: "Spring equinox", offsetDays: 10 },
      { title: "Longest day", offsetDays: 90 },
    ];

    const options = getOptimisticMessageOptions(data, 3, "north", upcomingMilestones);
    const milestoneHeadline = options.find((opt) => opt.headline.includes("until spring equinox"));

    expect(milestoneHeadline).toBeDefined();
    expect(milestoneHeadline.headline).toBe("Only 10 days until spring equinox!");
    expect(milestoneHeadline.lede).toBe("You're almost there :)");
  });

  it("excludes milestone headline when no milestones provided", () => {
    const data = {};

    const options = getOptimisticMessageOptions(data, 3, "north", []);
    const milestoneHeadline = options.find((opt) => opt.headline.includes("until"));

    expect(milestoneHeadline).toBeUndefined();
  });

  it("uses singular 'day' in milestone headline for 1 day", () => {
    const data = {};
    const upcomingMilestones = [{ title: "Summer solstice", offsetDays: 1 }];

    const options = getOptimisticMessageOptions(data, 6, "north", upcomingMilestones);
    const milestoneHeadline = options.find((opt) => opt.headline.includes("until summer solstice"));

    expect(milestoneHeadline).toBeDefined();
    expect(milestoneHeadline.headline).toBe("Only 1 day until summer solstice!");
  });

  it("rewrites daylight gain milestone titles for countdown headlines", () => {
    const data = {};
    const upcomingMilestones = [
      {
        title: "Gained 30 minutes of daylight since the winter solstice",
        offsetDays: 11,
      },
    ];

    const options = getOptimisticMessageOptions(data, 1, "north", upcomingMilestones);
    const milestoneHeadline = options.find((opt) => opt.headline.includes("until you've gained"));

    expect(milestoneHeadline).toBeDefined();
    expect(milestoneHeadline.headline).toBe(
      "Only 11 days until you've gained 30 minutes of daylight since the winter solstice!"
    );
  });

  it("rewrites daylight gain milestone titles for fallback ledes", () => {
    const data = {
      daylight_today: 600,
      daylight_in_14_days: 650,
    };
    const upcomingMilestones = [
      {
        title: "Gained 30 minutes of daylight since the winter solstice",
        offsetDays: 11,
      },
    ];

    const options = getOptimisticMessageOptions(data, 1, "north", upcomingMilestones);
    const messageWithNullLede = options.find((opt) =>
      opt.headline.includes("In two weeks, you'll have")
    );

    expect(messageWithNullLede).toBeDefined();
    expect(messageWithNullLede.lede).toBe(
      "Only 11 days until you've gained 30 minutes of daylight since the winter solstice!"
    );
  });

  it("drops 'Only' when day formatting becomes 'less than' weeks", () => {
    const data = {
      days_until_sunset_after_5pm: 20,
    };

    const options = getOptimisticMessageOptions(data, 1, "north");
    const message = options.find((opt) => opt.headline.includes("sunset reaches 5pm"));

    expect(message).toBeDefined();
    expect(message.headline).toBe("Less than 3 weeks until sunset reaches 5pm.");
  });

  it("drops 'only' mid-sentence when day formatting becomes 'less than' weeks", () => {
    const data = {
      days_until_max_daily_gain: 50,
    };

    const options = getOptimisticMessageOptions(data, 1, "north");
    const message = options.find((opt) => opt.headline.includes("largest daily increase"));

    expect(message).toBeDefined();
    expect(message.headline).toBe(
      "The largest daily increase in daylight is less than 8 weeks away."
    );
  });
});
