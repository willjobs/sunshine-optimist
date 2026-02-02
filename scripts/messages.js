import { clampValue } from "./utils/utils.js";
import { getAdjustedMonth } from "./utils/date-utils.js";
import { formatPlaceholderValue, lowerCaseFirstLetter } from "./formatters/formatters.js";

const PLACEHOLDER_PATTERN = /\{##[^}]*\}/;
const PLACEHOLDER_PATTERN_GLOBAL = /\{##([^}]*)\}/g;

const getPositiveNumber = (value, allowZero = false) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (allowZero ? value < 0 : value <= 0) {
    return null;
  }
  return value;
};

const getDelta = (current, previous, allowZero = false) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  const delta = current - previous;
  return getPositiveNumber(delta, allowZero);
};

const removeOnlyBeforeLessThan = (text) => {
  if (!text) {
    return "";
  }
  return text
    .replace(/\bOnly\s+less than\b/g, "Less than")
    .replace(/\bonly\s+less than\b/g, "less than");
};

// Patterns that read better with a definite article in countdown copy.
const COUNTDOWN_ARTICLE_PATTERNS = [
  /^(first|earliest|shortest|longest|next)\b/i,
  /^(spring|summer|fall|autumn|winter)\s+(equinox|solstice)\b/i,
];

const needsCountdownArticle = (title) =>
  COUNTDOWN_ARTICLE_PATTERNS.some((pattern) => pattern.test(title));

// Normalize milestone titles so countdowns read grammatically (e.g., "until the shortest day").
const formatMilestoneCountdownTitle = (title) => {
  if (!title) {
    return "";
  }
  const trimmed = title.trim();
  if (!trimmed) {
    return "";
  }
  if (/^gained\b/i.test(trimmed)) {
    return `you've ${lowerCaseFirstLetter(trimmed)}`;
  }
  if (/^(the|a|an)\b/i.test(trimmed)) {
    return trimmed;
  }
  if (needsCountdownArticle(trimmed)) {
    return `the ${lowerCaseFirstLetter(trimmed)}`;
  }
  return trimmed;
};

const fillMessageTemplate = (text, value) => {
  if (!text) {
    return "";
  }
  const filled = text.replace(PLACEHOLDER_PATTERN_GLOBAL, (_match, token) =>
    formatPlaceholderValue(token, value)
  );
  return removeOnlyBeforeLessThan(filled);
};

export const OPTIMISTIC_MESSAGES = [
  {
    headline: "Today's sunset is {## minutes} later than it was at its earliest.",
    lede: "Enjoy the extra evening light!",
    months: [1, 2, 3, 4, 12],
    data_needs: ["sunset_today", "sunset_earliest"],
    additional_requirements: "sunset_today > sunset_earliest",
    getValue: ({ sunset_today, sunset_earliest }) => getDelta(sunset_today, sunset_earliest, true),
  },
  {
    headline: "Today's sunset is {## minutes} later than it was at the start of the year.",
    lede: "It's so nice to have some evening light.",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    data_needs: ["sunset_today", "sunset_start_of_year"],
    additional_requirements: null,
    getValue: ({ sunset_today, sunset_start_of_year }) =>
      getDelta(sunset_today, sunset_start_of_year, true),
  },
  {
    headline: "Today's sunset is {## minutes} later than it was one month ago.",
    lede: "The days are definitely getting longer!",
    months: [2, 3, 4, 5],
    data_needs: ["sunset_today", "sunset_one_month_ago"],
    additional_requirements: "sunset_one_month_ago < sunset_today",
    getValue: ({ sunset_today, sunset_one_month_ago }) =>
      getDelta(sunset_today, sunset_one_month_ago),
  },
  {
    headline:
      "By the end of this month, days will be {## minutes} longer than the winter solstice.",
    lede: "Woohoo!",
    months: [1, 2, 3, 4],
    data_needs: ["daylight_minimum", "daylight_at_end_of_month"],
    additional_requirements: null,
    getValue: ({ daylight_at_end_of_month, daylight_minimum }) =>
      getDelta(daylight_at_end_of_month, daylight_minimum),
  },
  {
    headline: "You've gained {## minutes} of daylight since the winter solstice.",
    lede: "Loving that extra light 😎",
    months: [1, 2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_minimum"],
    additional_requirements: null,
    getValue: ({ daylight_today, daylight_minimum }) => getDelta(daylight_today, daylight_minimum),
  },
  {
    headline: "You have {## minutes} of daylight after 5pm.",
    lede: "Enjoy the extra evening light!",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    data_needs: ["daylight_after_5pm_today"],
    additional_requirements: "daylight_after_5pm_today > 0",
    getValue: ({ daylight_after_5pm_today }) => getPositiveNumber(daylight_after_5pm_today, true),
  },
  {
    headline: "You've gained {## minutes} of daylight in the last month.",
    lede: "Way to go!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_one_month_ago"],
    additional_requirements: null,
    getValue: ({ daylight_today, daylight_one_month_ago }) =>
      getDelta(daylight_today, daylight_one_month_ago),
  },
  {
    headline: "You still have {## minutes} more daylight than the winter solstice.",
    lede: "Plenty of time to enjoy the outdoors 🙂",
    months: [7, 8, 9, 10],
    data_needs: ["daylight_today", "daylight_minimum"],
    additional_requirements: null,
    getValue: ({ daylight_today, daylight_minimum }) => getDelta(daylight_today, daylight_minimum),
  },
  {
    headline: "Only {## minutes} of daylight remain to lose before the turnaround.",
    lede: "You can do this!",
    months: [11, 12],
    data_needs: ["daylight_today", "daylight_minimum"],
    additional_requirements: "today_date < winter_solstice_date",
    getValue: ({ daylight_today, daylight_minimum }) => getDelta(daylight_today, daylight_minimum),
  },
  {
    headline: "Most of the daylight loss is already behind you.",
    lede: "The days will start getting longer before you know it!",
    months: [11, 12],
    data_needs: ["winter_solstice_date", "today_date"],
    additional_requirements: "today_date < winter_solstice_date",
  },
  {
    headline: "Each day this week adds at least {## minutes} more daylight than the day before.",
    lede: "The pace of daylight gain is picking up!",
    months: [2, 3, 4],
    data_needs: ["daylight_daily_gain_this_week_min"],
    additional_requirements: null,
    getValue: ({ daylight_daily_gain_this_week_min }) =>
      getPositiveNumber(daylight_daily_gain_this_week_min),
  },
  {
    headline: "In two weeks, you'll have {## minutes} more daylight.",
    lede: null,
    months: [1, 2, 3, 4, 12],
    data_needs: ["daylight_today", "daylight_in_14_days"],
    additional_requirements: null,
    getValue: ({ daylight_in_14_days, daylight_today }) =>
      getDelta(daylight_in_14_days, daylight_today),
  },
  {
    headline: "Daylight gains are accelerating, with {## minutes} added this week.",
    lede: "Enjoy the extra light!",
    months: [1, 2, 3],
    data_needs: ["daylight_gain_this_week", "spring_equinox_date", "today_date"],
    additional_requirements: "today_date < spring_equinox_date",
    getValue: ({ daylight_gain_this_week }) => getPositiveNumber(daylight_gain_this_week),
  },
  {
    headline: "Each day you're gaining {## minutes} of daylight.",
    lede: "You deserve it for making it through winter!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_gain_today"],
    additional_requirements: null,
    getValue: ({ daylight_gain_today }) => getPositiveNumber(daylight_gain_today),
  },
  {
    headline: "You're gaining over {## minutes} of daylight per week right now.",
    lede: "Now we're talking!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_gain_this_week"],
    additional_requirements: null,
    getValue: ({ daylight_gain_this_week }) => getPositiveNumber(daylight_gain_this_week),
  },
  {
    headline: "Daylight loss is slowing down.",
    lede: "The turnaround is coming!",
    months: [10, 11],
    data_needs: ["daylight_loss_this_month", "daylight_loss_last_month"],
    additional_requirements: "daylight_loss_this_month < daylight_loss_last_month",
  },
  {
    headline: "Only {## days} until sunset reaches 5pm.",
    lede: "Get ready for those longer evenings!",
    months: [1, 2, 3],
    data_needs: ["days_until_sunset_after_5pm"],
    additional_requirements: "days_until_sunset_after_5pm > 0",
    getValue: ({ days_until_sunset_after_5pm }) => getPositiveNumber(days_until_sunset_after_5pm),
  },
  {
    headline: "Only {## days} until sunset reaches 6pm.",
    lede: "Get ready for those longer evenings!",
    months: [2, 3, 4],
    data_needs: ["days_until_sunset_after_6pm"],
    additional_requirements: "days_until_sunset_after_6pm > 0",
    getValue: ({ days_until_sunset_after_6pm }) => getPositiveNumber(days_until_sunset_after_6pm),
  },
  {
    headline: "Only {## days} until sunset reaches 7pm.",
    lede: "Pretty soon it'll feel like summer!",
    months: [3, 4, 5],
    data_needs: ["days_until_sunset_after_7pm"],
    additional_requirements: "days_until_sunset_after_7pm > 0",
    getValue: ({ days_until_sunset_after_7pm }) => getPositiveNumber(days_until_sunset_after_7pm),
  },
  {
    headline: "The largest daily increase in daylight is only {## days} away.",
    lede: "Hang in there!",
    months: [2, 3],
    data_needs: ["days_until_max_daily_gain"],
    additional_requirements: "days_until_max_daily_gain > 0",
    getValue: ({ days_until_max_daily_gain }) => getPositiveNumber(days_until_max_daily_gain),
  },
  {
    headline: "Only {## days} until the longest day of the year.",
    lede: "Summer is almost here!",
    months: [5, 6],
    data_needs: ["days_until_summer_solstice"],
    additional_requirements: "days_until_summer_solstice > 0",
    getValue: ({ days_until_summer_solstice }) => getPositiveNumber(days_until_summer_solstice),
  },
  {
    headline: "You still have over {## weeks} of sunset after 7pm.",
    lede: "Enjoy those long summer evenings!",
    months: [7, 8, 9],
    data_needs: ["weeks_with_sunset_after_7pm_remaining"],
    additional_requirements: "weeks_with_sunset_after_7pm_remaining > 0",
    getValue: ({ weeks_with_sunset_after_7pm_remaining }) =>
      getPositiveNumber(weeks_with_sunset_after_7pm_remaining),
  },
  {
    headline: "Only {## days} remain until daylight loss stops entirely.",
    lede: "The turnaround is near!",
    months: [11, 12],
    data_needs: ["days_until_winter_solstice"],
    additional_requirements: "days_until_winter_solstice > 0",
    getValue: ({ days_until_winter_solstice }) => getPositiveNumber(days_until_winter_solstice),
  },
  {
    headline: "The earliest sunset is only {## days} away.",
    lede: "You can do this!",
    months: [11, 12],
    data_needs: ["days_until_earliest_sunset"],
    additional_requirements: "days_until_earliest_sunset > 0",
    getValue: ({ days_until_earliest_sunset }) => getPositiveNumber(days_until_earliest_sunset),
  },
  {
    headline: "You've regained {##%} of the daylight lost in winter.",
    lede: "It feels better every day!",
    months: [2, 3, 4, 5],
    data_needs: ["daylight_today", "daylight_minimum", "daylight_maximum"],
    additional_requirements: null,
    getValue: ({ daylight_today, daylight_minimum, daylight_maximum }) => {
      if (
        !Number.isFinite(daylight_today) ||
        !Number.isFinite(daylight_minimum) ||
        !Number.isFinite(daylight_maximum)
      ) {
        return null;
      }
      const range = daylight_maximum - daylight_minimum;
      if (range <= 0) {
        return null;
      }
      const ratio = (daylight_today - daylight_minimum) / range;
      return clampValue(ratio * 100, 0, 100);
    },
  },
  {
    headline: "You're {##%} of the way to the shortest day.",
    lede: "Then things get longer again; hang in there!",
    months: [9, 10, 11, 12],
    data_needs: ["summer_solstice_date", "winter_solstice_date", "today_date"],
    additional_requirements: "today_date < winter_solstice_date",
    getValue: ({ summer_solstice_date, winter_solstice_date, today_date }) => {
      if (
        !(summer_solstice_date instanceof Date) ||
        !(winter_solstice_date instanceof Date) ||
        !(today_date instanceof Date)
      ) {
        return null;
      }
      const total = winter_solstice_date.getTime() - summer_solstice_date.getTime();
      if (total <= 0) {
        return null;
      }
      const progress = today_date.getTime() - summer_solstice_date.getTime();
      return clampValue((progress / total) * 100, 0, 100);
    },
  },
  {
    headline: "Today has more daylight than {##%} of the year.",
    lede: "Pretty amazing, right?",
    months: [5, 6, 7, 8, 9],
    data_needs: ["days_with_less_daylight"],
    additional_requirements: null,
    getValue: ({ days_with_less_daylight, days_in_year }) => {
      if (!Number.isFinite(days_with_less_daylight) || !Number.isFinite(days_in_year)) {
        return null;
      }
      if (days_in_year <= 0) {
        return null;
      }
      return clampValue((days_with_less_daylight / days_in_year) * 100, 0, 100);
    },
  },
  {
    headline: "Daylight is within {## minutes} of its yearly maximum.",
    lede: "The payoff for making it through winter!",
    months: [5, 6],
    data_needs: ["daylight_today", "daylight_maximum"],
    additional_requirements: null,
    getValue: ({ daylight_today, daylight_maximum }) => {
      if (!Number.isFinite(daylight_today) || !Number.isFinite(daylight_maximum)) {
        return null;
      }
      return getPositiveNumber(Math.abs(daylight_maximum - daylight_today), true);
    },
  },
  {
    headline: "Sunsets are getting later again!",
    lede: null,
    months: [12],
    data_needs: ["date_today", "date_of_earliest_sunset"],
    additional_requirements: "date_today > date_of_earliest_sunset",
  },
  {
    headline: "The shortest day is behind you!",
    lede: null,
    months: [12],
    data_needs: ["date_today", "winter_solstice_date"],
    additional_requirements: "date_today > winter_solstice_date",
  },
  {
    headline: "Today still has {## minutes} more daylight than the average winter day.",
    lede: "I'll take it!",
    months: [9, 10, 11],
    data_needs: ["daylight_today", "average_winter_daylight"],
    additional_requirements: null,
    getValue: ({ daylight_today, average_winter_daylight }) =>
      getDelta(daylight_today, average_winter_daylight),
  },
  {
    headline: "You're losing less than {## minutes} of daylight per week now.",
    lede: "You're doing great!",
    months: [10, 11, 12],
    data_needs: ["daylight_loss_this_week"],
    additional_requirements: null,
    getValue: ({ daylight_loss_this_week }) => getPositiveNumber(daylight_loss_this_week),
  },
  {
    headline: "Only {## days} until {next_milestone_title}!",
    lede: "You're almost there :)",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    data_needs: ["next_milestone_days", "next_milestone_title"],
    additional_requirements: "next_milestone_days > 0",
    getValue: ({ next_milestone_days }) => getPositiveNumber(next_milestone_days),
  },
];

const isValidDataValue = (value) => {
  if (value === null) {
    return false;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return Number.isFinite(value);
};

const resolveRequirementValue = (token, data) => {
  if (Object.prototype.hasOwnProperty.call(data, token)) {
    return data[token];
  }
  const numeric = Number(token);
  return Number.isFinite(numeric) ? numeric : null;
};

const compareRequirementValues = (left, operator, right) => {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    return false;
  }
  switch (operator) {
    case ">":
      return leftValue > rightValue;
    case "<":
      return leftValue < rightValue;
    case ">=":
      return leftValue >= rightValue;
    case "<=":
      return leftValue <= rightValue;
    case "==":
      return leftValue === rightValue;
    case "===":
      return leftValue === rightValue;
    default:
      return false;
  }
};

const evaluateRequirement = (requirement, data) => {
  if (!requirement) {
    return true;
  }
  const match = requirement.match(/^([a-z0-9_]+)\s*(<=|>=|<|>|===|==)\s*([a-z0-9_.-]+)$/i);
  if (!match) {
    return false;
  }
  const left = resolveRequirementValue(match[1], data);
  const right = resolveRequirementValue(match[3], data);
  return compareRequirementValues(left, match[2], right);
};

const hasPlaceholder = (text) => PLACEHOLDER_PATTERN.test(text || "");

/**
 * Get the fallback lede message based on upcoming milestones
 * @param {Array} upcomingMilestones - Array of upcoming milestones with offsetDays and title
 * @returns {string|null} The fallback lede message or null if no milestones
 */
const getMilestoneFallbackLede = (upcomingMilestones) => {
  if (!Array.isArray(upcomingMilestones) || upcomingMilestones.length === 0) {
    return null;
  }
  const nextMilestone = upcomingMilestones[0];
  if (!nextMilestone || !Number.isFinite(nextMilestone.offsetDays) || !nextMilestone.title) {
    return null;
  }
  const days = nextMilestone.offsetDays;
  const title = formatMilestoneCountdownTitle(nextMilestone.title).toLowerCase();
  return `Only ${days} ${days === 1 ? "day" : "days"} until ${title}!`;
};

export const getOptimisticMessageOptions = (data, month, hemisphere, upcomingMilestones = []) => {
  const adjustedMonth = getAdjustedMonth(month, hemisphere);

  // Only show milestones as messages if they're within 5 weeks
  const MAX_MILESTONE_MESSAGE_DAYS = 35;
  const nearbyMilestones = Array.isArray(upcomingMilestones)
    ? upcomingMilestones.filter((m) => m.offsetDays <= MAX_MILESTONE_MESSAGE_DAYS)
    : [];

  // Inject milestone data into the data object
  const nextMilestone = nearbyMilestones.length > 0 ? nearbyMilestones[0] : null;
  const enrichedData = {
    ...data,
    next_milestone_days:
      nextMilestone && Number.isFinite(nextMilestone.offsetDays) ? nextMilestone.offsetDays : null,
    next_milestone_title: nextMilestone?.title || null,
  };

  const candidates = OPTIMISTIC_MESSAGES.filter((message) =>
    message.months.includes(adjustedMonth)
  );
  const validMessages = candidates
    .map((message) => {
      if (
        !message.data_needs.every((key) => isValidDataValue(enrichedData[key])) ||
        (message.additional_requirements &&
          !evaluateRequirement(message.additional_requirements, enrichedData))
      ) {
        return null;
      }
      const needsValue = hasPlaceholder(message.headline) || hasPlaceholder(message.lede);
      if (!needsValue) {
        return { message, value: null };
      }
      const value = message.getValue ? message.getValue(enrichedData) : null;
      if (!Number.isFinite(value)) {
        return null;
      }
      return { message, value };
    })
    .filter(Boolean);
  const milestoneFallbackLede = getMilestoneFallbackLede(nearbyMilestones);
  return validMessages.map((entry) => {
    const milestoneTitle = formatMilestoneCountdownTitle(enrichedData.next_milestone_title);
    let headline = fillMessageTemplate(entry.message.headline, entry.value);
    let lede = fillMessageTemplate(entry.message.lede, entry.value);
    // Replace data placeholders like {next_milestone_title}
    headline = headline.replace(/\{next_milestone_title\}/g, (milestoneTitle || "").toLowerCase());
    lede = lede.replace(/\{next_milestone_title\}/g, milestoneTitle || "");
    return {
      headline,
      lede: lede || milestoneFallbackLede || "",
    };
  });
};
