# Architecture

Sunshine Optimist is a static, single-page web app that runs entirely in the browser with no backend services. It uses ES modules with no build step.

## Directory Structure

```
scripts/
├── app.js                    # Thin orchestrator, event wiring, controller coordination
├── controllers/
│   ├── date-controller.js    # Date picker state management
│   ├── location-controller.js # City search, geolocation, results
│   ├── daylight-controller.js # Async sun calculations, milestones, stats
│   └── optimistic-controller.js # Message selection and rotation
├── state/
│   └── app-state.js          # Centralized state management
├── ui/
│   ├── confetti-ui.js        # Confetti animation for milestones
│   ├── message-ui.js         # Optimistic message rotation
│   ├── milestone-ui.js       # Milestone card rendering
│   ├── share-modal-ui.js     # Share modal functionality
│   └── tooltip-ui.js         # Delta tooltip behavior
├── services/
│   ├── geocoding-service.js  # Open-Meteo API for city search
│   ├── reverse-geocode-service.js # BigDataCloud API for coords to place name
│   └── storage-service.js    # localStorage abstraction
├── formatters/
│   └── formatters.js         # All formatting functions consolidated
├── utils/
│   ├── astronomy-utils.js    # Astronomy Engine wrapper with caching
│   ├── date-utils.js         # Date/time utilities with cached formatters
│   ├── location-utils.js     # Location formatting and filtering
│   ├── dom-utils.js          # Basic DOM helpers
│   └── utils.js              # General utilities
├── messages.js               # Optimistic message templates
└── milestones.js             # Milestone definitions
```

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `app.js` | Thin orchestrator, event wiring, controller coordination |
| `controllers/date-controller.js` | Date picker state and commit handling |
| `controllers/location-controller.js` | City search, geolocation, results |
| `controllers/daylight-controller.js` | Async sun calculations, milestones, stats |
| `controllers/optimistic-controller.js` | Message selection and rotation |
| `state/app-state.js` | All application state |
| `services/*` | External API calls |
| `ui/*` | UI component logic |
| `formatters/formatters.js` | All display formatting |
| `utils/astronomy-utils.js` | Sun/season calculations with caching and async APIs |
| `utils/date-utils.js` | Date/time manipulation with cached formatters |
| `utils/location-utils.js` | Location parsing and formatting |
| `utils/dom-utils.js` | Basic DOM helpers |
| `utils/utils.js` | General utilities |
| `messages.js` | Message template definitions |
| `milestones.js` | Milestone definitions |

## State Management

All application state is centralized in `scripts/state/app-state.js`:
- Location state (search results, active location, user coordinates, recent locations)
- Date state (live vs custom date, commit timeout)
- Milestone state (upcoming milestones, current index)
- Optimistic message state (rotation interval, current index)
- Share state (snapshot, privacy preference)

State is accessed and modified through exported getter/setter functions.

## Key Flows

### Location Selection
- Typing in the search field triggers Open-Meteo geocoding. Results are grouped into matches and nearby results, with optional region token filtering.
- If geolocation is allowed, `app.js` biases results by distance and can select the current location.
- Recent and last-active locations are stored in `localStorage`.
- When the current location is selected, the app reverse-geocodes it via BigDataCloud to display a real place name.

### Date and Timezone Handling
- The date picker defaults to today, but custom dates are supported.
- The app always evaluates dates in the selected location's time zone, not the user's.
- Helpers in `date-utils.js` convert between UTC and local date parts.

### Daylight Calculations
- `daylight-controller.js` uses Astronomy Engine to compute sunrise/sunset plus derived values like day length.
- It scans the year to find extremes (earliest sunset, shortest/longest day) and seasonal dates (equinoxes and solstices), cached in `astronomy-utils.js`.
- Heavy full-year calculations use async APIs (`getYearlySunExtremesAsync`, `getAverageWinterDaylightAsync`) that yield to the main thread in chunks to avoid UI jank.

### Optimistic Messaging
- `messages.js` defines templates with `months`, `data_needs`, and optional `additional_requirements`.
- Placeholders like `{## minutes}` are filled via `getValue` when needed.
- `getOptimisticMessageOptions` returns the valid messages; `message-ui.js` rotates them and falls back to default copy when nothing matches.
- If a milestone is today, milestone copy overrides the rotating message.

### Milestones
- `milestones.js` contains threshold and daylight-gain milestones.
- `daylight-controller.js` adds computed milestones such as earliest/shortest/longest day, equinoxes, DST start, and the next half-hour sunset.
- The milestone card cycles through upcoming entries; a confetti effect fires on milestone days.

### Sharing
- The share modal builds a text snapshot from the current state, with optional privacy mode ("My Location").
- Users can copy to the clipboard or open prefilled social share links.

## Controller Communication

Controllers communicate via callback registration (e.g., `setLocationChangeCallback`, `setDateChangeCallback`) to avoid circular dependencies. When a location or date changes, the registered callback triggers daylight recalculation.
