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
│   ├── story-image-ui.js     # Instagram story image generation (Canvas)
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

sw.js                         # Service worker for offline support and caching
manifest.json                 # PWA manifest for app installation
```

## Module Responsibilities

| Module                                 | Responsibility                                           |
| -------------------------------------- | -------------------------------------------------------- |
| `app.js`                               | Thin orchestrator, event wiring, controller coordination |
| `controllers/date-controller.js`       | Date picker state and commit handling                    |
| `controllers/location-controller.js`   | City search, geolocation, results                        |
| `controllers/daylight-controller.js`   | Async sun calculations, milestones, stats                |
| `controllers/optimistic-controller.js` | Message selection and rotation                           |
| `state/app-state.js`                   | All application state                                    |
| `services/*`                           | External API calls                                       |
| `ui/*`                                 | UI component logic                                       |
| `ui/story-image-ui.js`                 | Canvas-based Instagram story image generation            |
| `formatters/formatters.js`             | All display formatting                                   |
| `utils/astronomy-utils.js`             | Sun/season calculations with caching and async APIs      |
| `utils/date-utils.js`                  | Date/time manipulation with cached formatters            |
| `utils/location-utils.js`              | Location parsing and formatting                          |
| `utils/dom-utils.js`                   | Basic DOM helpers                                        |
| `utils/utils.js`                       | General utilities                                        |
| `messages.js`                          | Message template definitions                             |
| `milestones.js`                        | Milestone definitions                                    |
| `sw.js`                                | Service worker for offline support and API caching       |
| `manifest.json`                        | PWA manifest for installability                          |

## State Management

All application state is centralized in `scripts/state/app-state.js`:

- **Location state**: Search results, active location, user coordinates, recent locations, filter tokens
- **Date state**: Live vs custom date, commit timeout, last keydown timestamp
- **Milestone state**: Upcoming milestones, current index, timezone, last celebrated key, confetti timeout
- **Optimistic message state**: Rotation interval, current index, swap ID and timeout
- **Share state**: Snapshot, modal snapshot, privacy preference, cached share text
- **Reverse geocode state**: Cache, cache key, in-flight promise
- **Debug state**: Valid/displayed options, data, month, hemisphere, reason, last update timestamp

State is accessed and modified through exported getter/setter functions. The module provides batch update support and state batching for performance.

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

- The share modal supports two modes: **Text** and **Image/Story**
- **Text mode**: Builds a formatted text snapshot with daylight data, progress bars, and milestone info
  - Privacy mode available to share as "My Location" instead of actual city name
  - Copy to clipboard via Clipboard API
  - Social share links for Instagram (copy), Facebook, X/Twitter, and Bluesky
- **Image mode**: Generates 1080x1920px Instagram Story image using Canvas API
  - Warm gradient background with headline and location
  - Waits for web fonts to load before rendering
  - Download as PNG via blob URL
- Share state captured in snapshot when modal opens, ensuring consistency
- Reverse geocoding for "Current Location" happens asynchronously to resolve to real place name

## Controller Communication

Controllers communicate via callback registration (e.g., `setLocationChangeCallback`, `setDateChangeCallback`) to avoid circular dependencies. When a location or date changes, the registered callback triggers daylight recalculation.

## Progressive Web App (PWA)

### Service Worker Caching Strategy

The service worker ([sw.js](../sw.js)) implements different caching strategies for different resource types:

**Static Assets** (cache-first):

- HTML, CSS, JavaScript files
- Astronomy Engine library
- All app modules
- Cached on service worker install
- Network fallback with offline support
- Cache version: `sunshine-optimist-static-v1`

**API Requests** (network-first with stale-while-revalidate):

- Open-Meteo Geocoding API
- BigDataCloud Reverse Geocoding API
- Tries network first, updates cache on success
- Falls back to cached response (max 24 hours old) on network failure
- Adds custom timestamp header for cache validation
- Cache version: `sunshine-optimist-api-v1`

**External Resources** (network-only):

- Google Fonts
- Other CDN resources
- Relies on their own caching headers

**Cache Lifecycle**:

- `install`: Precaches all static assets
- `activate`: Deletes old cache versions, takes control immediately via `skipWaiting()` and `clients.claim()`
- Old caches cleaned up automatically on version change

### Offline Support

- Complete app functionality available offline with last-used data
- Static assets served from cache
- Recent API responses available for 24 hours
- Navigation requests fall back to cached `index.html`
- Location calculations work entirely client-side (no network required)

### Installability

Web app manifest ([manifest.json](../manifest.json)) provides:

- App name: "Sunshine Optimist"
- Standalone display mode (no browser UI)
- Portrait orientation
- Theme colors: `#e69522` (orange) for theme, `#fffbf0` (cream) for background
- SVG icon (scalable, works as maskable)
- Categories: weather, utilities, lifestyle

## Performance Optimizations

### Caching Layers

**Astronomy Calculations**:

- Sun events cached by date parts key (year-month-day)
- Yearly extremes cached by year and approximate daylight
- Seasonal dates cached by year and hemisphere
- Cache invalidated on location change
- Prevents redundant expensive calculations

**Reverse Geocoding**:

- Results cached by coordinate key (lat,lon rounded to 4 decimals)
- In-flight request deduplication: same coordinates share single promise
- Cache cleared on location change or coordinate update
- Prevents redundant API calls for same location

**Formatters**:

- Date formatters (`Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`) created once and cached
- Reused across all date/time formatting operations
- Significant performance improvement over creating new formatters each time

### Async Operations

**Full-Year Scans**:

- `getYearlySunExtremesAsync()`: Yields every 30 iterations to avoid blocking UI
- `getAverageWinterDaylightAsync()`: Yields every 7 days of calculations
- Uses `await new Promise(resolve => setTimeout(resolve, 0))` to yield to main thread
- Critical for maintaining 60fps during heavy calculations

**Debouncing**:

- Search input: 250ms debounce
- Date input: 1.2s debounce (immediate on blur/Enter)
- Prevents excessive API calls and recalculations

**Request Management**:

- `AbortController` cancels previous geocoding requests on new input
- Single in-flight promise per reverse geocoding coordinate set
- Date commit timeout cleared on rapid changes

### DOM Efficiency

- Direct DOM manipulation (no virtual DOM overhead)
- Batch state updates where possible via `batchStateUpdates()`
- CSS transitions for animations (GPU-accelerated)
- Tooltips created once, content updated dynamically
- Confetti self-cleaning (removes DOM elements after animation)

## Testing

### Unit Tests (Vitest)

63 tests across 17 test files covering:

- Date utilities and timezone handling
- Message selection logic and placeholders
- State management getters/setters
- Location utilities (parsing, filtering, formatting)
- Formatters (duration, deltas, tooltips, share text)
- Service layer (geocoding, reverse geocoding, storage)
- UI components (messages, milestones, tooltips, confetti, share modal)
- Controllers (date, daylight)

### End-to-End Tests (Playwright)

6 test suites covering:

- App initialization and loading
- Date selection and timezone synchronization
- Default location loading
- Milestone tooltips and interactions
- Location search and selection
- Share modal functionality (text and image modes)

### Test Philosophy

- Unit tests for business logic and utilities
- E2E tests for user flows and integration
- No mocking of Astronomy Engine (uses real calculations in tests)
- Tests run in JSDOM environment (unit) and headless browsers (E2E)
- All tests passing indicates app is production-ready

## Browser Compatibility

**Minimum Requirements**:

- ES Modules support
- ES2020 features (optional chaining, nullish coalescing, async/await)
- Modern Web APIs: Fetch, Geolocation, Canvas, Clipboard, Service Worker
- Modern browsers: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+

**Graceful Degradation**:

- No geolocation: Falls back to default location
- No Clipboard API: Copy button hidden or disabled
- No Service Worker: App works but no offline support
- No Dialog element: Uses attribute-based fallback
- No Permissions API: Skips permission check, manual geolocation grant

## Security Considerations

**API Calls**:

- All external APIs called over HTTPS
- No user credentials or sensitive data transmitted
- Geocoding APIs are public (no API keys exposed)
- CORS handled by API providers

**User Data**:

- Location data stored only in browser's localStorage (not transmitted)
- Share privacy mode prevents accidental location disclosure
- No analytics or tracking
- No cookies used

**Content Security**:

- Static site hosted on HTTPS
- Service worker enforces same-origin policy for caching
- External resources (fonts, API calls) loaded over HTTPS
- No inline scripts or eval usage
