const US_STATE_ABBR = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const US_STATE_NAME_BY_ABBR = Object.fromEntries(
  Object.entries(US_STATE_ABBR).map(([name, abbr]) => [abbr.toLowerCase(), name])
);

const STATE_ALIAS_BY_TOKEN = {
  dc: "District of Columbia",
};

export const CURRENT_LOCATION_LABEL = "Current Location";

export const normalizeCountryCode = (item) => (item.country_code || "").toUpperCase();

export const formatSelectedLocation = (item) => {
  const isUnitedStates =
    normalizeCountryCode(item) === "US" || item.country?.toLowerCase() === "united states";
  const regionName = item.admin1 || "";
  const region =
    isUnitedStates && US_STATE_ABBR[regionName] ? US_STATE_ABBR[regionName] : regionName;
  const parts = isUnitedStates ? [item.name, region] : [item.name, item.country];
  return parts.filter(Boolean).join(", ");
};

export const formatSuggestionLocation = formatSelectedLocation;

export const isCurrentLocation = (location) =>
  Boolean(location?.isCurrent) ||
  (location?.name || "").toLowerCase() === CURRENT_LOCATION_LABEL.toLowerCase();

const normalizeToken = (value) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();

const expandFilterTokens = (tokens) => {
  const expanded = new Set();
  tokens.forEach((token) => {
    const normalized = normalizeToken(token);
    if (!normalized) {
      return;
    }
    expanded.add(normalized);
    const alias = STATE_ALIAS_BY_TOKEN[normalized];
    if (alias) {
      expanded.add(normalizeToken(alias));
    }
    const stateName = US_STATE_NAME_BY_ABBR[normalized];
    if (stateName) {
      expanded.add(normalizeToken(stateName));
    }
  });
  return [...expanded];
};

const formatFilterTokens = (tokens) =>
  tokens.map((token) => (token.length === 2 ? token.toUpperCase() : token)).join(" ");

export const parseQuery = (query) => {
  const parts = query.split(",");
  const name = (parts[0] || "").trim();
  const filterText = parts.slice(1).join(" ").trim();
  let tokens = filterText
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);
  let nameQuery = name || query;
  if (!tokens.length) {
    const words = name.split(/\s+/).filter(Boolean);
    const lastToken = normalizeToken(words[words.length - 1] || "");
    if (words.length > 1 && US_STATE_NAME_BY_ABBR[lastToken]) {
      tokens = [lastToken];
      nameQuery = words.slice(0, -1).join(" ");
    }
  }
  return {
    nameQuery: nameQuery || query,
    filterTokens: expandFilterTokens(tokens),
    rawFilterTokens: tokens,
  };
};

const normalizeNameValue = (value) => normalizeToken(value);

export const isNameMatch = (item, nameQuery) => {
  if (!nameQuery) {
    return true;
  }
  const normalizedQuery = normalizeNameValue(nameQuery);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeNameValue(item.name || "").startsWith(normalizedQuery);
};

const matchesToken = (item, token) => {
  if (!token) {
    return true;
  }
  const fields = [item.admin1, item.admin2, item.country].filter(Boolean);
  const normalizedFields = fields.map((field) => normalizeNameValue(field));
  if (normalizedFields.some((field) => field.startsWith(token))) {
    return true;
  }
  const wordMatch = fields.some((field) =>
    field
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => word.startsWith(token))
  );
  if (wordMatch) {
    return true;
  }
  const stateMatch = fields.some((field) => US_STATE_ABBR[field] === token.toUpperCase());
  if (stateMatch) {
    return true;
  }
  const countryCode = (item.country_code || "").toLowerCase();
  return countryCode ? countryCode.startsWith(token) : false;
};

export const applyFilterTokens = (items, tokens) => {
  if (!tokens.length) {
    return items;
  }
  return items.filter((item) => tokens.every((token) => matchesToken(item, token)));
};

export const formatFilterTokensForHint = (tokens) => formatFilterTokens(tokens);

export const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
};

export const sortByDistance = (items, userCoords) => {
  if (!userCoords) {
    return items;
  }
  return [...items].sort((a, b) => {
    const distanceA = distanceKm(userCoords.lat, userCoords.lon, a.latitude, a.longitude);
    const distanceB = distanceKm(userCoords.lat, userCoords.lon, b.latitude, b.longitude);
    return distanceA - distanceB;
  });
};
