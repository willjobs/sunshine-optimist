# Sunshine Optimist

Sunshine Optimist is a single-page, browser-based experience that turns sunrise and
sunset calculations into upbeat, seasonal insights about daylight for a chosen city.

The purpose is to provide a website where people can go to get optimistic takes on the current amount of sunlight where they are. The idea is to battle the dread or sadness people feel as the days get shorter, or for those winter months when the days are getting longer but they are still so very short.

## Current functionality

- City search with typeahead backed by the Open-Meteo geocoding API; supports
  optional geolocation bias, local/worldwide toggles, and recent locations saved
  in `localStorage`.
- Date picker with a Today reset so you can explore daylight insights for other
  days in the selected location.
- Dynamic headline and lede selected from a seasonal, hemisphere-aware catalog
  and rotated when multiple messages apply, with polar-day/night fallback copy.
- Stats panel for today's sunset time and total daylight, including comparisons
  to the earliest sunset, the shortest day, and the most recent week/month with
  tooltip context.
- Upcoming milestone carousel covering next half-hour sunsets, seasonal extrema
  and events, sunset-threshold milestones, and daylight-gain milestones (plus
  confetti when a milestone lands).
- Share modal with preview text, a privacy toggle for "My Location",
  copy-to-clipboard, and social share shortcuts.

## How the optimistic message is chosen

The headline + lede are computed in `scripts/app.js` from a structured catalog in
`scripts/messages.js`. The selection flow is:

1. Compute `messageData` for the active location/date (sunset time, daylight
   duration, seasonal markers, and relative deltas such as “days until sunset
   after 6pm”). These values come from Astronomy Engine calculations plus local
   time-zone conversion.
2. If there is no valid sunrise/sunset for the date (e.g., polar night/day),
   the copy is hard-coded to “Sunlight looks different here / No sunrise or
   sunset today.”
3. Otherwise, adjust the current month for hemisphere (southern hemisphere shifts
   by six months) so messages align with the local season.
4. Filter the message catalog to entries whose `months` include the adjusted
   month, then discard any that do not have all required data (`data_needs`) or
   fail their `additional_requirements` comparison (simple expressions like
   `sunset_today > sunset_earliest`).
5. If a message uses `{## ...}` placeholders, compute its `getValue` number and
   format it based on the token contents (minutes, days, weeks, or percent).
6. Rotate through the remaining valid candidates in the UI every 15 seconds. If
   no candidates remain, fall back to “Enjoy the daylight today / Every bit of
   sunshine helps.”
7. Finally, if today matches a milestone date, the milestone copy overrides the
   optimistic message for that day.

## Project layout

- `index.html` — markup and structural layout.
- `styles.css` — global styles.
- `scripts/app.js` — UI wiring, state, and orchestration.
- `scripts/messages.js` — optimistic message templates and selection logic.
- `scripts/milestones.js` — milestone definitions and copy.
- `scripts/utils.js` — shared helpers.
- `astronomy-engine/astronomy.browser.min.js` — bundled Astronomy Engine for solar
  events and seasonal calculations.

## Data sources and dependencies

- Open-Meteo Geocoding API for city lookup and default location.
- BigDataCloud reverse geocoding for turning current coordinates into a readable
  place name.
- Browser Geolocation API (optional) for nearby result biasing.
- Astronomy Engine for solar event and seasonal calculations.
