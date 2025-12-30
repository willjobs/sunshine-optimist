# Sunshine Optimist - Agent Guide

## Purpose
Sunshine Optimist is a static, single-page web app that turns sunrise and sunset
calculations into optimistic daylight insights for any city and date. It runs
entirely in the browser with no backend services.

## Architecture overview
- `index.html` defines the UI: location search, date picker, headline/lede, stats,
  milestone card, and share modal.
- `styles.css` contains all styling and responsive layout rules.
- `scripts/app.js` owns state, event wiring, and DOM updates.
- `scripts/date-utils.js` handles date parts math, time-zone conversion, and
  date/time formatting helpers.
- `scripts/astronomy-utils.js` wraps Astronomy Engine calculations with caching
  for sun events, yearly extremes, and seasonal dates.
- `scripts/location-utils.js` formats locations, parses query tokens, and
  filters/sorts suggestion results.
- `scripts/share-utils.js` builds share formatting helpers and progress lines.
- `scripts/dom-utils.js` contains small DOM helpers.
- `scripts/messages.js` is the message catalog and filtering helpers.
- `scripts/milestones.js` defines threshold and daylight-gain milestone templates.
- `astronomy-engine/astronomy.browser.min.js` provides solar and seasonal math.

## Key flows
### Location selection
- Typing in the search field triggers Open-Meteo geocoding. Results are grouped
  into matches and nearby results, with optional region token filtering.
- If geolocation is allowed, `app.js` biases results by distance and can select
  the current location.
- Recent and last-active locations are stored in `localStorage`.
- When the current location is selected, the app attempts to reverse-geocode it
  via BigDataCloud so the UI can display a real place name.

### Date and timezone handling
- The date picker defaults to today, but custom dates are supported.
- The app always evaluates dates in the selected location's time zone, not the
  user's.
- Helpers in `app.js` convert between UTC and local date parts to keep
  comparisons consistent.

### Daylight calculations
- `app.js` uses Astronomy Engine to compute sunrise and sunset plus derived
  values like day length.
- It scans the year to find extremes (earliest sunset, shortest/longest day) and
  seasonal dates (equinoxes and solstices), now cached in `scripts/astronomy-utils.js`.
- These values feed the stats panel and the message/milestone logic.

### Optimistic messaging
- `scripts/messages.js` defines templates with `months`, `data_needs`, and
  optional `additional_requirements`.
- Placeholders like `{## minutes}` are filled via `getValue` when needed.
- `getOptimisticMessageOptions` returns the valid messages; `app.js` rotates them
  and falls back to default copy when nothing matches.
- If a milestone is today, milestone copy overrides the rotating message.

### Milestones
- `scripts/milestones.js` contains threshold and daylight-gain milestones.
- `app.js` adds computed milestones such as earliest/shortest/longest day,
  equinoxes, DST start, and the next half-hour sunset.
- The milestone card cycles through upcoming entries; a confetti effect fires on
  milestone days.

### Sharing
- The share modal builds a text snapshot from the current state, with optional
  privacy mode ("My Location").
- Users can copy to the clipboard or open prefilled social share links.
- The share preview is updated when the modal opens or the privacy toggle changes.

## Development and contributions
- This is a static site with ES modules. Run a local server (for example
  `python3 -m http.server`) and open `http://localhost:8000`.
- When adding messages in `scripts/messages.js`, ensure required `data_needs`
  keys exist in the `messageData` object in `scripts/app.js`.
- When adding new milestones, update `scripts/milestones.js` or the milestone
  builder in `scripts/app.js` and verify ordering and labels in the UI.
- If you change `index.html` ids/classes, update the DOM selectors in
  `scripts/app.js` and keep the ARIA attributes for the location combobox intact.
- Manual checks usually cover the main flows: search, local/worldwide toggle,
  date picker, milestone rotation, and the share modal.
