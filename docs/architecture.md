# Architecture

Sunshine Optimist is a static, single-page web app that runs entirely in the browser. It uses ES modules with no build step.

## Directory Structure

```
scripts/
├── app.js                      # Orchestrator: event wiring, controller coordination
├── controllers/
│   ├── date-controller.js      # Date picker state and commit handling
│   ├── location-controller.js  # City search, geolocation, results
│   ├── milestone-explorer-controller.js # In-place city milestone discovery
│   ├── daylight-controller.js  # Sun calculations, milestones, stats
│   └── optimistic-controller.js # Message selection and rotation
├── data/
│   └── major-cities.js         # 100 major world cities for milestone scanning
├── state/
│   └── app-state.js            # Centralized state management
├── ui/
│   ├── confetti-ui.js          # Confetti animation for milestones
│   ├── message-ui.js           # Optimistic message rotation
│   ├── milestone-ui.js         # Milestone card rendering
│   ├── share-modal-ui.js       # Share modal functionality
│   ├── story-image-ui.js       # Instagram story image generation (Canvas)
│   └── tooltip-ui.js           # Delta tooltip behavior
├── services/
│   ├── geocoding-service.js    # Open-Meteo API for city search
│   ├── milestone-scanner-service.js # Scans major cities for today's milestones
│   ├── reverse-geocode-service.js # BigDataCloud API for coords to place name
│   └── storage-service.js      # localStorage abstraction
├── formatters/
│   └── formatters.js           # All formatting functions
├── utils/
│   ├── astronomy-utils.js      # Astronomy Engine wrapper with caching
│   ├── date-utils.js           # Date/time utilities with cached formatters
│   ├── location-utils.js       # Location formatting and filtering
│   ├── dom-utils.js            # Basic DOM helpers
│   └── utils.js                # General utilities
├── messages.js                 # Optimistic message templates
└── milestones.js               # Milestone definitions

sw.js                           # Service worker for offline support
manifest.webmanifest            # PWA manifest
```

## State Management

All application state is centralized in `scripts/state/app-state.js`:

- **Location state**: Search results, active location, user coordinates, recent locations
- **Date state**: Live vs custom date, commit timeout
- **Milestone state**: Upcoming milestones, current index, timezone
- **Optimistic message state**: Rotation interval, current index
- **Share state**: Snapshot, modal snapshot, privacy preference, share mode, last generated canvas
- **Reverse geocode state**: Cache, in-flight promise

State is accessed through exported getter/setter functions.

## Key Flows

### Location Selection

1. Typing in the search field triggers Open-Meteo geocoding
2. Results are grouped into matches and nearby results, with optional region token filtering
3. If geolocation is allowed, results are biased by distance
4. Recent and last-active locations are stored in localStorage
5. For "Current Location", the app reverse-geocodes via BigDataCloud to display a real place name
6. Geolocated selections retain their origin so stored coordinates can refresh when permission is granted
7. Saved locations are validated before use; malformed entries cannot reach date or daylight calculations

### Date and Timezone Handling

- The date picker defaults to today in the selected location's timezone
- All dates are evaluated in the location's timezone, not the user's
- Today mode refreshes at the selected location's midnight and rechecks when the tab becomes visible
- Helpers in `date-utils.js` convert between UTC and local date parts

### Daylight Calculations

- `daylight-controller.js` uses Astronomy Engine to compute sunrise/sunset
- It scans the year to find extremes (earliest sunset, shortest/longest day)
- Day-over-day deltas (sunset gain and daylight gain vs yesterday) are computed in `calculateDeltas` and displayed as subline gain badges beneath the stat values
- Heavy calculations use async APIs (`getYearlySunExtremesAsync`) that yield to the main thread

### Optimistic Messaging

- `messages.js` defines templates with `months`, `data_needs`, and optional `additional_requirements`
- Placeholders like `{## minutes}` are filled via `getValue` when needed
- `getOptimisticMessageOptions` returns valid messages; `message-ui.js` rotates them (values that round to 0 are excluded)
- Dot indicators below the message are interactive buttons; clicking/tapping a dot navigates to that message and resets the auto-rotation timer
- Messages with the same non-null `group` are de-duplicated by best `getValue` (highest value, except `sunset_countdown` and `milestone_countdown` use the lowest), and the list is capped
- If a milestone is today, milestone copy overrides the rotating message

### Milestones

- `milestones.js` contains threshold and daylight-gain milestones
- `daylight-controller.js` adds computed milestones (earliest/shortest/longest day, equinoxes, DST, first 12hr day, finished 10 darkest weeks)
- The milestone card cycles through upcoming entries; confetti fires on milestone days
- Easter egg: clearing the location input shows a "Find cities with milestones" button that scans 100 major world cities to find up to 5 with a milestone today
- A persistent action below the milestone card uses the same city scan and shows matching cities with their milestone names in place

### Sharing

- **Text mode**: Formatted text with daylight data, progress bars, and milestone info
- **Image mode (default)**: 1080x1920px Instagram Story image generated via Canvas API
- Privacy mode displays "My Location" instead of actual city name

## Controller Communication

Controllers communicate via callback registration (e.g., `setLocationChangeCallback`, `setDateChangeCallback`) to avoid circular dependencies. When a location or date changes, the registered callback triggers daylight recalculation.

## Progressive Web App

### Service Worker Strategy

**Static assets** (cache-first): HTML, CSS, and JavaScript are fetched with release-versioned URLs and `cache: "reload"` during installation, then served from that release's cache. A failed precache leaves the previous worker active. Fetches consult only the active release cache; `ignoreSearch: true` lets requests for either bare or matching-version URLs use its entries. A request bearing a newer version goes to the network instead of receiving the old worker's copy. The HTML import map versions every JavaScript module in the app's import graph, so a new entry script cannot load a module left in the browser's HTTP cache from a previous release.

GitHub Pages supplies the site's HTTP cache headers. Release URLs and service worker cache names provide invalidation without depending on custom `_headers` rules.

**API requests** (network-only): Location search, reverse geocoding, and coordinate timezone requests require a connection. Each request has a bounded timeout, and stored location data lets the app continue to calculate daylight offline.

**Google Fonts** (network-first with cache fallback): Font CSS and font files from `fonts.googleapis.com` and `fonts.gstatic.com` are cached in a dedicated font cache. On subsequent loads, the service worker tries the network first and updates the cache; offline, it falls back to the cached version.

### Offline Support

- Complete app functionality available offline with last-used data
- New location searches and coordinate lookups require a connection
- Location calculations work entirely client-side

## Performance Optimizations

### Caching Layers

- **Astronomy calculations**: Cached by date parts, year, and hemisphere
- **Reverse geocoding**: Cached by coordinate key with in-flight request deduplication
- **Formatters**: `Intl.DateTimeFormat` objects created once and reused

### Async Operations

- `getYearlySunExtremesAsync()`: Yields every 30 iterations
- `getAverageWinterDaylightAsync()`: Yields every 7 days
- Uses `setTimeout(resolve, 0)` to yield to main thread

### Debouncing

- Search input: 250ms
- Date input: 300ms (immediate on blur/Enter)
- `AbortController` cancels previous geocoding requests

## Browser Compatibility

**Minimum requirements**: ES Modules, ES2020 features (optional chaining, nullish coalescing), Fetch, Geolocation, Canvas, Clipboard, Service Worker.

**Supported browsers**: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+.

**Graceful degradation**: No geolocation falls back to the Boston default location. Copying text requires the Clipboard API. No Service Worker means no offline support.
