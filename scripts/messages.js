import { clampValue } from "./utils/utils.js";
import { getAdjustedMonth } from "./utils/date-utils.js";
import { formatPlaceholderValue, formatMilestoneCountdown } from "./formatters/formatters.js";

const MAX_MESSAGES = 10;
const delta = (current, previous) =>
  Number.isFinite(current) && Number.isFinite(previous) ? current - previous : null;
const percentageRegained = ({ daylight_today, daylight_minimum, daylight_maximum }) => {
  if (![daylight_today, daylight_minimum, daylight_maximum].every(Number.isFinite)) return null;
  const range = daylight_maximum - daylight_minimum;
  return range >= 60
    ? clampValue((100 * (daylight_today - daylight_minimum)) / range, 0, 100)
    : null;
};

// Constraints use raw values. Formatting happens only after a message qualifies.
export const OPTIMISTIC_MESSAGES = [
  {
    id: "daylight-twin",
    group: null,
    headline: "Today has as much daylight as {daylight_twin_date}. They're twins!",
    lede: "Same amount of sunlight, a different chapter of the year.",
    months: [8, 9],
    data_needs: ["daylight_twin_date"],
  },
  {
    id: "sunset-earliest",
    group: "sunset_comparison",
    headline: "Sunset is {## minutes} later than winter's earliest sunset.",
    lede: "Enjoy the extra evening light!",
    months: [1, 2, 3, 4, 12],
    data_needs: ["sunset_today", "sunset_earliest"],
    getValue: (d) => delta(d.sunset_today, d.sunset_earliest),
    min: 10,
    when: (d) => d.after_sunset_turnaround === 1,
  },
  {
    id: "sunset-start-of-year",
    group: "sunset_comparison",
    headline: "Today's sunset is {## minutes} later than it was at the start of the year.",
    lede: "It's so nice to have some evening light.",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    data_needs: ["sunset_today", "sunset_start_of_year"],
    getValue: (d) => delta(d.sunset_today, d.sunset_start_of_year),
    min: 30,
  },
  {
    id: "sunset-month",
    group: "sunset_comparison",
    headline: "Sunset is {## minutes} later than a month ago.",
    lede: "The days are definitely getting longer!",
    months: [2, 3, 4, 5],
    data_needs: ["sunset_today", "sunset_one_month_ago"],
    getValue: (d) => delta(d.sunset_today, d.sunset_one_month_ago),
    min: 15,
    when: (d) => d.after_winter_solstice === 1 && d.days_are_lengthening === 1,
  },
  {
    id: "month-end",
    group: "daylight_gained",
    headline: "By month's end, you'll have {## minutes} more daylight than on the shortest day.",
    lede: "Woohoo!",
    months: [1, 2, 3, 4],
    data_needs: ["daylight_minimum", "daylight_at_end_of_month", "daylight_today"],
    getValue: (d) => delta(d.daylight_at_end_of_month, d.daylight_minimum),
    min: 30,
    when: (d) =>
      d.days_until_month_end > 0 && delta(d.daylight_at_end_of_month, d.daylight_today) >= 10,
  },
  {
    id: "since-shortest",
    group: "daylight_gained",
    headline: "You've gained {## minutes} of daylight since the shortest day.",
    lede: "Loving that extra light 😎",
    months: [1, 2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_minimum"],
    getValue: (d) => delta(d.daylight_today, d.daylight_minimum),
    min: 15,
    when: (d) => d.days_are_lengthening === 1,
  },
  {
    id: "after-5pm",
    group: null,
    headline: "Enjoy {## minutes} of daylight after 5pm today.",
    lede: "Enjoy the extra evening light!",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    data_needs: ["daylight_after_5pm_today"],
    getValue: (d) => d.daylight_after_5pm_today,
    min: 30,
  },
  {
    id: "daylight-month",
    group: "daylight_gained",
    headline: "You've gained {## minutes} of daylight in the last month.",
    lede: "Way to go!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_one_month_ago"],
    getValue: (d) => delta(d.daylight_today, d.daylight_one_month_ago),
    min: 15,
  },
  {
    id: "above-shortest",
    group: null,
    headline: "Today has {## minutes} more daylight than the shortest day.",
    lede: "Plenty of time to enjoy the outdoors 🙂",
    months: [7, 8, 9, 10],
    data_needs: ["daylight_today", "daylight_minimum"],
    getValue: (d) => delta(d.daylight_today, d.daylight_minimum),
    min: 90,
  },
  {
    id: "loss-behind",
    group: null,
    headline: "You’ve made it through {##%} of the year’s daylight loss.",
    lede: "Longer days are on their way.",
    months: [11, 12],
    data_needs: ["fraction_of_loss_completed"],
    getValue: (d) => d.fraction_of_loss_completed * 100,
    min: 75,
    max: 100,
    when: (d) => d.daylight_gain_today < 0,
  },
  {
    id: "two-weeks",
    group: null,
    headline: "In two weeks, you'll have {## minutes} more daylight.",
    lede: null,
    months: [1, 2, 3, 4, 12],
    data_needs: ["daylight_today", "daylight_in_14_days"],
    getValue: (d) => delta(d.daylight_in_14_days, d.daylight_today),
    min: 15,
  },
  {
    id: "accelerating",
    group: "gain_rate",
    priority: 1,
    headline: "Daylight gains are accelerating, with {## minutes} added this week.",
    lede: "Enjoy the extra light!",
    months: [1, 2, 3],
    data_needs: ["daylight_gain_this_week"],
    getValue: (d) => d.daylight_gain_this_week,
    min: 10,
    when: (d) =>
      d.before_spring_equinox === 1 &&
      d.after_winter_solstice === 1 &&
      d.gains_are_accelerating === 1,
  },
  {
    id: "daily-gain",
    group: "gain_rate",
    headline: "Today has {## minutes} more daylight than yesterday.",
    lede: "Enjoy the extra light!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_gain_today"],
    getValue: (d) => d.daylight_gain_today,
    min: 1,
  },
  {
    id: "weekly-gain",
    group: "gain_rate",
    headline: "You've gained {## minutes} of daylight over the past week!",
    lede: "Now we're talking!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_gain_this_week"],
    getValue: (d) => d.daylight_gain_this_week,
    min: 10,
  },
  {
    id: "loss-slowdown",
    group: null,
    headline: "Daylight loss is {##%} slower than a month ago.",
    lede: "The turnaround is coming!",
    months: [10, 11, 12],
    data_needs: ["daylight_loss_slowdown_percent"],
    getValue: (d) => d.daylight_loss_slowdown_percent,
    min: 25,
    max: 100,
    when: (d) => d.daylight_gain_today < 0,
  },
  {
    id: "largest-increase",
    group: "milestone_countdown",
    headline: "The largest increase in daylight is {## days} away.",
    lede: "Enjoy the growing daylight!",
    months: [2, 3],
    data_needs: ["days_until_max_daily_gain"],
    getValue: (d) => d.days_until_max_daily_gain,
    min: 1,
    max: 42,
  },
  {
    id: "late-summer-evenings",
    group: null,
    headline: "You still have around {## weeks} of sunset after 7pm.",
    lede: "Enjoy those long summer evenings!",
    months: [7, 8, 9],
    data_needs: ["weeks_with_sunset_after_7pm_remaining"],
    getValue: (d) => d.weeks_with_sunset_after_7pm_remaining,
    min: 2,
  },
  {
    id: "longer-days-countdown",
    group: "milestone_countdown",
    headline: "Only {## days} until days start getting longer again!",
    lede: "Longer days are on their way.",
    months: [11, 12],
    data_needs: ["days_until_longer_days"],
    getValue: (d) => d.days_until_longer_days,
    min: 1,
    max: 35,
  },
  {
    id: "later-sunsets-countdown",
    group: "milestone_countdown",
    headline: "Only {## days} until sunsets start getting later again!",
    lede: "Brighter evenings are on their way.",
    months: [11, 12],
    data_needs: ["days_until_later_sunsets"],
    getValue: (d) => d.days_until_later_sunsets,
    min: 1,
    max: 35,
  },
  {
    id: "regained",
    group: null,
    headline: "You've regained {##%} of the daylight lost since summer.",
    lede: "It feels better every day!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_minimum", "daylight_maximum"],
    getValue: percentageRegained,
    min: 25,
    max: 100,
    when: (d) => d.days_are_lengthening === 1,
  },
  {
    id: "daylight-percentile",
    group: null,
    headline: "Today has more daylight than {##%} of days this year.",
    lede: "Pretty amazing, right?",
    months: [5, 6, 7, 8, 9],
    data_needs: ["days_with_less_daylight", "days_in_year"],
    getValue: (d) =>
      d.days_in_year > 0
        ? clampValue((100 * d.days_with_less_daylight) / d.days_in_year, 0, 100)
        : null,
    min: 60,
  },
  {
    id: "near-longest",
    group: null,
    headline: "Today is just {## minutes} shy of the year's longest day.",
    lede: "Enjoy the long days!",
    months: [5, 6],
    data_needs: ["daylight_today", "daylight_maximum"],
    getValue: (d) => delta(d.daylight_maximum, d.daylight_today),
    min: 0.5,
    max: 30,
    when: (d) => d.before_summer_solstice === 1,
  },
  {
    id: "brightest-weeks",
    group: null,
    headline: "You're in the 10 weeks with the most daylight of the year.",
    lede: "Keep those sunglasses handy.",
    months: [5, 6, 7],
    data_needs: ["is_in_brightest_70_days"],
    when: (d) => d.is_in_brightest_70_days === 1,
  },
  {
    id: "rear-view",
    group: null,
    headline: "The shortest day is in your rear-view mirror ({## days} ago).",
    lede: null,
    months: [12, 1],
    data_needs: ["days_since_shortest_day"],
    getValue: (d) => d.days_since_shortest_day,
    min: 1,
    max: 14,
    when: (d) => d.days_are_lengthening === 1,
  },
  {
    id: "above-winter-average",
    group: null,
    headline: "Today has {## minutes} more daylight than the average winter day.",
    lede: "Enjoy the extra daylight!",
    months: [9, 10, 11],
    data_needs: ["daylight_today", "average_winter_daylight"],
    getValue: (d) => delta(d.daylight_today, d.average_winter_daylight),
    min: 90,
  },
];

const isValidDataValue = (value) =>
  value instanceof Date
    ? Number.isFinite(value.getTime())
    : typeof value === "string"
      ? value.length > 0
      : Number.isFinite(value);

const fill = (template, value, data) =>
  (template || "")
    .replace(/\{##([^}]*)\}/g, (_match, token) => formatPlaceholderValue(token, value))
    .replace(/\{daylight_twin_date\}/g, data.daylight_twin_date || "")
    .replace(/\bOnly less than\b/g, "Less than");

export const getOptimisticMessageOptions = (data, month, hemisphere, upcomingMilestones = []) => {
  const adjustedMonth = getAdjustedMonth(month, hemisphere);
  const nearby = (Array.isArray(upcomingMilestones) ? upcomingMilestones : [])
    .filter(
      (m) =>
        !m.informationalOnly &&
        Number.isFinite(m.offsetDays) &&
        m.offsetDays > 0 &&
        m.offsetDays <= 35
    )
    .sort((a, b) => a.offsetDays - b.offsetDays);
  const countdown = formatMilestoneCountdown(nearby[0]);
  const candidates = OPTIMISTIC_MESSAGES.filter((m) => m.months.includes(adjustedMonth)).flatMap(
    (message) => {
      if (
        !message.data_needs.every((key) => isValidDataValue(data[key])) ||
        (message.when && !message.when(data))
      )
        return [];
      const value = message.getValue ? message.getValue(data) : null;
      if (
        message.getValue &&
        (!Number.isFinite(value) ||
          value < (message.min ?? 0.5) ||
          value > (message.max ?? Infinity))
      )
        return [];
      return [{ message, value }];
    }
  );
  const best = new Map();
  for (const entry of candidates) {
    const { group } = entry.message;
    if (!group) continue;
    const previous = best.get(group);
    const prefer =
      !previous ||
      (entry.message.priority || 0) > (previous.message.priority || 0) ||
      ((entry.message.priority || 0) === (previous.message.priority || 0) &&
        (group === "milestone_countdown"
          ? entry.value < previous.value
          : entry.value > previous.value));
    if (prefer) best.set(group, entry);
  }
  const options = candidates
    .filter((entry) => !entry.message.group || best.get(entry.message.group) === entry)
    .map(({ message, value }) => ({
      id: message.id,
      headline: fill(message.headline, value, data),
      lede: fill(message.lede, value, data) || countdown,
    }));
  if (countdown && !options.some((option) => option.headline === countdown))
    options.push({
      id: "milestone-countdown",
      headline: countdown,
      lede: nearby[0].offsetDays <= 7 ? "You're almost there :)" : "Something to look forward to.",
    });
  // A milestone with identical dedicated countdown copy mustn't repeat underneath itself.
  return options
    .slice(0, MAX_MESSAGES)
    .map((option) => ({ ...option, lede: option.lede === option.headline ? "" : option.lede }));
};
