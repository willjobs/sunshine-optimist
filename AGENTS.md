# Sunshine Optimist - Agent Guide

## Purpose
Sunshine Optimist is a static, single-page web app that turns sunrise and sunset
calculations into optimistic daylight insights for any city and date. It runs
entirely in the browser with no backend services.

## Architecture overview

The application follows a modular architecture with clear separation of concerns:

### Directory Structure
```
scripts/
├── app.js                    # Thin orchestrator, event wiring, controller coordination
├── controllers/
│   ├── date-controller.js    # Date picker state management
│   ├── location-controller.js # City search, geolocation, results
│   ├── daylight-controller.js # Sun calculations, milestones, stats
│   └── optimistic-controller.js # Message selection and rotation
├── state/
│   └── app-state.js          # Centralized state management
├── ui/
│   ├── confetti-ui.js        # Confetti animation for milestones
│   ├── message-ui.js         # Optimistic message rotation
│   ├── milestone-ui.js       # Milestone card rendering
│   ├── share-modal-ui.js     # Share modal functionality
│   ├── stats-ui.js           # Stats panel rendering
│   └── tooltip-ui.js         # Delta tooltip behavior
├── services/
│   ├── geocoding-service.js  # Open-Meteo API for city search
│   ├── reverse-geocode-service.js # BigDataCloud API for coords to place name
│   └── storage-service.js    # localStorage abstraction
├── formatters/
│   └── formatters.js         # All formatting functions consolidated
├── messages.js               # Optimistic message templates
├── milestones.js             # Milestone definitions
├── astronomy-utils.js        # Astronomy Engine wrapper with caching
├── date-utils.js             # Date/time utilities
├── location-utils.js         # Location formatting and filtering
├── dom-utils.js              # Basic DOM helpers
└── utils.js                  # General utilities
```

### Core Files
- **`index.html`** defines the UI: location search, date picker, headline/lede, stats,
  milestone card, and share modal.
- **`styles.css`** contains all styling and responsive layout rules.
- **`scripts/app.js`** is a thin orchestrator that wires up event handlers
  and coordinates between controllers.

### Controllers
Domain-specific logic is organized into controllers in **`scripts/controllers/`**:
- **`date-controller.js`**: Date picker state (custom vs live date), syncing, debounced commits
- **`location-controller.js`**: City search, results rendering, geolocation, location selection
- **`daylight-controller.js`**: Sun metrics calculation, delta comparisons, milestone building, stats UI
- **`optimistic-controller.js`**: Optimistic message selection and rotation logic

Controllers communicate via callback registration (e.g., `setLocationChangeCallback`, `setDateChangeCallback`)
to avoid circular dependencies. When a location or date changes, the registered callback triggers
daylight recalculation.

### State Management
All application state is centralized in **`scripts/state/app-state.js`**:
- Location state (search results, active location, user coordinates, recent locations)
- Date state (live vs custom date, commit timeout)
- Milestone state (upcoming milestones, current index)
- Optimistic message state (rotation interval, current index)
- Share state (snapshot, privacy preference)

State is accessed and modified through exported getter/setter functions.

### Services
API calls are isolated in service modules:
- **`geocoding-service.js`**: City search via Open-Meteo API
- **`reverse-geocode-service.js`**: Coordinate to place name via BigDataCloud
- **`storage-service.js`**: localStorage for persisting preferences

### UI Modules
Each UI component is in its own module:
- **`message-ui.js`**: Message rotation with fade animations
- **`milestone-ui.js`**: Milestone card display and cycling
- **`share-modal-ui.js`**: Share modal, preview, and social links
- **`tooltip-ui.js`**: Interactive tooltips for delta references
- **`confetti-ui.js`**: Celebration animation for milestone days

### Formatters
All formatting logic is consolidated in **`formatters/formatters.js`**:
- Duration formatting (hours/minutes)
- Delta statements ("X minutes later")
- Placeholder values for messages
- Share text formatting

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
- Helpers in `date-utils.js` convert between UTC and local date parts.

### Daylight calculations
- `daylight-controller.js` uses Astronomy Engine to compute sunrise and sunset plus derived
  values like day length.
- It scans the year to find extremes (earliest sunset, shortest/longest day) and
  seasonal dates (equinoxes and solstices), cached in `astronomy-utils.js`.
- These values feed the stats panel and the message/milestone logic.

### Optimistic messaging
- `messages.js` defines templates with `months`, `data_needs`, and
  optional `additional_requirements`.
- Placeholders like `{## minutes}` are filled via `getValue` when needed.
- `getOptimisticMessageOptions` returns the valid messages; `message-ui.js`
  rotates them and falls back to default copy when nothing matches.
- If a milestone is today, milestone copy overrides the rotating message.

### Milestones
- `milestones.js` contains threshold and daylight-gain milestones.
- `daylight-controller.js` adds computed milestones such as earliest/shortest/longest day,
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
- The console logs the full optimistic message list whenever the location/date
  recalculates. `window.SunshineOptimistDebug` exposes
  `getOptimisticMessages()` and `printOptimisticMessages()` for ad-hoc checks.
- When adding messages in `messages.js`, ensure required `data_needs`
  keys exist in the `messageData` object in `daylight-controller.js`.
- When adding new milestones, update `milestones.js` or the milestone
  builder in `daylight-controller.js` and verify ordering and labels in the UI.
- If you change `index.html` ids/classes, update the DOM selectors in
  `app.js` and keep the ARIA attributes for the location combobox intact.
- Manual checks usually cover the main flows: search, local/worldwide toggle,
  date picker, milestone rotation, and the share modal.

## Module responsibilities

| Module | Responsibility |
|--------|----------------|
| `app.js` | Thin orchestrator, event wiring, controller coordination |
| `controllers/date-controller.js` | Date picker state and commit handling |
| `controllers/location-controller.js` | City search, geolocation, results |
| `controllers/daylight-controller.js` | Sun calculations, milestones, stats |
| `controllers/optimistic-controller.js` | Message selection and rotation |
| `state/app-state.js` | All application state |
| `services/*` | External API calls |
| `ui/*` | UI component logic |
| `formatters/formatters.js` | All display formatting |
| `astronomy-utils.js` | Sun/season calculations with caching |
| `date-utils.js` | Date/time manipulation |
| `location-utils.js` | Location parsing and formatting |
| `messages.js` | Message template definitions |
| `milestones.js` | Milestone definitions |
