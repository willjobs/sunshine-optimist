const padDatePart = (value) => String(value).padStart(2, "0");

export const formatDateInputValue = (parts) => {
  if (!parts) {
    return "";
  }
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
};

export const parseDateInputValue = (value) => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return { year, month, day };
};

const zonedPartsFormatterCache = new Map();

const getZonedPartsFormatter = (timeZone) => {
  if (!zonedPartsFormatterCache.has(timeZone)) {
    zonedPartsFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    );
  }
  return zonedPartsFormatterCache.get(timeZone);
};

export const getZonedParts = (date, timeZone) => {
  const formatter = getZonedPartsFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

export const getTimeZoneOffsetMinutes = (date, timeZone) => {
  const parts = getZonedParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return (utcTime - date.getTime()) / 60000;
};

export const zonedTimeToUtc = (year, month, day, hour, minute, second, timeZone) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  let utcTime = new Date(utcGuess.getTime() - offset * 60000);
  const revisedOffset = getTimeZoneOffsetMinutes(utcTime, timeZone);
  if (revisedOffset !== offset) {
    utcTime = new Date(utcGuess.getTime() - revisedOffset * 60000);
  }
  return utcTime;
};

export const getLocalDateParts = (date, timeZone) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return { year, month, day };
};

export const getLocalNoonDateFromParts = (parts, timeZone) => {
  if (!parts) {
    return null;
  }
  return zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
};

export const addDaysToDateParts = (parts, deltaDays) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

export const addMonthsToDateParts = (parts, deltaMonths) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    day: Math.min(parts.day, daysInMonth),
  };
};

export const getDaysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const compareDateParts = (left, right) => {
  if (!left || !right) {
    return 0;
  }
  if (left.year !== right.year) {
    return left.year < right.year ? -1 : 1;
  }
  if (left.month !== right.month) {
    return left.month < right.month ? -1 : 1;
  }
  if (left.day !== right.day) {
    return left.day < right.day ? -1 : 1;
  }
  return 0;
};

export const getDaysBetweenDateParts = (startParts, endParts) => {
  if (!startParts || !endParts) {
    return null;
  }
  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  return Math.round((endUtc - startUtc) / 86400000);
};

export const getDaysInYear = (year) => {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / 86400000);
};

export const getMinutesSinceMidnight = (date, timeZone) => {
  const { hour, minute, second } = getZonedParts(date, timeZone);
  return hour * 60 + minute + second / 60;
};

const buildFormatterKey = (options) =>
  Object.entries(options)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

export const createDateFormatter = (localeSource) => {
  const formatterCache = new Map();
  const getFormatter = (options) => {
    const key = `${options.timeZone || ""}|${buildFormatterKey(options)}`;
    if (!formatterCache.has(key)) {
      formatterCache.set(key, new Intl.DateTimeFormat(localeSource, options));
    }
    return formatterCache.get(key);
  };

  const formatTime = (date, timeZone) =>
    getFormatter({
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);

  const formatLongDateFromParts = (parts, timeZone) => {
    if (!parts) {
      return "";
    }
    const date = zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
    return getFormatter({
      timeZone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatShortDateFromParts = (parts, timeZone, referenceYear = null) => {
    if (!parts) {
      return "";
    }
    const date = zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
    const options = {
      timeZone,
      month: "short",
      day: "numeric",
    };
    if (referenceYear !== null && parts.year !== referenceYear) {
      options.year = "numeric";
    }
    return getFormatter(options).format(date);
  };

  const formatTimeFromMinutes = (minutes, dateParts, timeZone) => {
    const hour = Math.floor(minutes / 60);
    const minute = Math.round(minutes % 60);
    const date = zonedTimeToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      hour,
      minute,
      0,
      timeZone
    );
    return formatTime(date, timeZone);
  };

  return {
    formatTime,
    formatLongDateFromParts,
    formatShortDateFromParts,
    formatTimeFromMinutes,
  };
};

export const shiftMonth = (month, offset) => ((month - 1 + offset) % 12) + 1;

export const getAdjustedMonth = (month, hemisphere) =>
  hemisphere === "south" ? shiftMonth(month, 6) : month;
