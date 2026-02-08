# Architecture

Sunshine Optimist is a static, single-page web app that runs entirely in the browser. It uses ES modules with no build step.

## Directory Structure

```
scripts/
├── app.js                      # Orchestrator: event wiring, controller coordination
├── controllers/
│   ├── date-controller.js      # Date picker state and commit handling
│   ├── location-controller.js  # City search, geolocation, results
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

State is accessed through exported getter/setter functions. The module supports batch updates for performance.

## Key Flows

### Location Selection

1. Typing in the search field triggers Open-Meteo geocoding
2. Results are grouped into matches and nearby results, with optional region token filtering
3. If geolocation is allowed, results are biased by distance
4. Recent and last-active locations are stored in localStorage
5. For "Current Location", the app reverse-geocodes via BigDataCloud to display a real place name

### Date and Timezone Handling

- The date picker defaults to today in the selected location's timezone
- All dates are evaluated in the location's timezone, not the user's
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

### Sharing

- **Text mode**: Formatted text with daylight data, progress bars, and milestone info
- **Image mode**: 1080x1920px Instagram Story image generated via Canvas API
- Privacy mode displays "My Location" instead of actual city name

## Controller Communication

Controllers communicate via callback registration (e.g., `setLocationChangeCallback`, `setDateChangeCallback`) to avoid circular dependencies. When a location or date changes, the registered callback triggers daylight recalculation.

## Progressive Web App

### Service Worker Strategy

**Static assets** (cache-first): HTML, CSS, JavaScript, cached on install with network fallback. Cache matching uses `ignoreSearch: true` so versioned query strings (e.g., `?v=v132-abc123`) match bare cached URLs.

**API requests** (network-first with stale-while-revalidate): Geocoding APIs try network first, fall back to cached response (max 24 hours old).

**Google Fonts** (network-first with cache fallback): Font CSS and font files from `fonts.googleapis.com` and `fonts.gstatic.com` are cached in a dedicated font cache. On subsequent loads, the service worker tries the network first and updates the cache; offline, it falls back to the cached version.

### Offline Support

- Complete app functionality available offline with last-used data
- Recent API responses available for 24 hours
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
- Date input: 1.2s (immediate on blur/Enter)
- `AbortController` cancels previous geocoding requests

## Browser Compatibility

**Minimum requirements**: ES Modules, ES2020 features (optional chaining, nullish coalescing), Fetch, Geolocation, Canvas, Clipboard, Service Worker.

**Supported browsers**: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+.

**Graceful degradation**: No geolocation falls back to default location. No Clipboard API hides copy button. No Service Worker means no offline support.
