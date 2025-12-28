# Sunshine Optimist

Sunshine Optimist is a single-page, browser-based experience that turns sunrise and
sunset calculations into upbeat, seasonal insights about daylight for a chosen city.

The purpose is to provide a website where people can go to get optimistic takes on the current amount of sunlight where they are. The idea is to battle the dread or sadness people feel as the days get shorter, or for those winter months when the days are getting longer but they are still so very short.

## Current functionality

- Location search with typeahead backed by the Open-Meteo geocoding API; supports
  optional geolocation bias, local/worldwide toggling, and recent locations saved
  in `localStorage`.
- Dynamic headline and lede that select an optimistic message based on computed
  daylight metrics and hemisphere-aware season logic.
- "Coming up" milestone that finds the next sunset after the next half-hour mark
  and reports the date plus days away.
- Stats panel for today's sunset time and total daylight, with deltas versus the
  earliest sunset, shortest day, and the prior month (with comparison tooltips).
- Share button that copies the current headline and lede to the clipboard.

## Project layout

- `index.html` — markup, styles, and client-side logic.
- `astronomy-engine/astronomy.browser.min.js` — bundled Astronomy Engine for solar
  events and seasonal calculations.

## Data sources and dependencies

- Open-Meteo Geocoding API for city lookup and default location.
- Browser Geolocation API (optional) for nearby result biasing.
- Astronomy Engine for solar event and seasonal calculations.
