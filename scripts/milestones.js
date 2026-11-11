const SUNSET_TIMES = [
  ["4", "4pm", 960],
  ["430", "4:30pm", 990],
  ["5", "5pm", 1020],
  ["530", "5:30pm", 1050],
  ["6", "6pm", 1080],
  ["7", "7pm", 1140],
  ["8", "8pm", 1200],
];

export const SUNSET_THRESHOLD_MILESTONES = SUNSET_TIMES.map(([id, label, minutes]) => ({
  id: `sunset-after-${id}`,
  title: `Sunset after ${label}`,
  minutes,
  countdownTitle: `sunset is after ${label}`,
  todayHeadline: `Sunset is now after ${label}!`,
  todayLede: "Enjoy the evening light!",
}));

export const SUNRISE_THRESHOLD_MILESTONES = [8, 7, 6].map((hour) => ({
  id: `sunrise-before-${hour}`,
  title: `Sunrise stays before ${hour}am`,
  minutes: hour * 60,
  countdownTitle: `sunrise stays before ${hour}am`,
  todayHeadline: `Sunrise now stays before ${hour}am.`,
  todayLede: "Brighter mornings are here.",
}));

export const DAYLIGHT_GAIN_MILESTONES = [
  [30, "30m", "30 minutes"],
  [60, "1h", "1 hour"],
  [90, "1h 30m", "1 hour 30 minutes"],
  [120, "2h", "2 hours"],
].map(([minutes, compact, label]) => ({
  id: `gain-${minutes}`,
  title: `${compact} daylight gained`,
  minutes,
  countdownTitle: `you've gained ${label} of daylight since the shortest day`,
  todayHeadline: `You've gained ${label} of daylight since the shortest day.`,
  todayLede: "Enjoy the extra daylight!",
}));

export const DAYLIGHT_DURATION_MILESTONES = [10, 11].map((hours) => ({
  id: `first-${hours}-hours`,
  title: `${hours}+ hours of daylight`,
  minutes: hours * 60,
  countdownTitle: `days reach ${hours} hours of daylight`,
  todayHeadline: `Today brings at least ${hours} hours of daylight.`,
  todayLede: "Enjoy the longer days!",
}));
