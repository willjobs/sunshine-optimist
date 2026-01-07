# Application Behavior

This document describes the complete behavior of Sunshine Optimist, including all user interactions, automatic behaviors, data flows, and edge cases.

## Overview

Sunshine Optimist is a single-page web application that provides upbeat, seasonal insights about daylight for any city. The app combats seasonal sadness by highlighting positive aspects of daylight changes, especially during darker months.

## Initial Load Behavior

### First-Time User

1. **Geolocation Check**: The app checks browser geolocation permission status
2. **Auto-Location** (if permission granted):
   - Requests user's coordinates via browser geolocation API
   - Shows "Locating..." state on geolocation button
   - Performs reverse geocoding to convert coordinates to a place name (via BigDataCloud API)
   - Automatically selects the current location
   - Stores location in localStorage for future visits
3. **Fallback Location** (if geolocation denied/unavailable):
   - Attempts to load location from localStorage
   - If no stored location, fetches default location based on browser language/region
   - Falls back to New York City if all else fails
4. **Initial Display**:
   - Date picker defaults to today's date
   - Calculates all sun metrics for the selected location and date
   - Displays optimistic headline and lede
   - Shows sunset time and daylight duration with comparison deltas
   - Displays next upcoming milestone

### Returning User

1. Loads last-used location from localStorage
2. Loads recent locations list (up to 5)
3. Loads share privacy preference
4. If last-used location was "Current Location", checks if geolocation is available and updates coordinates
5. Auto-selects the stored location and displays data
6. Does not automatically request geolocation unless permission is already granted

## Location Search

### Search Interface

**Input Field**:

- Minimum 2 characters required to trigger search
- 250ms debounce delay before API call
- Supports filter tokens: `#region`, `#country`, `#admin` to filter by region/country/state
- Shows "Clear" button when text is present
- Pressing Escape closes results panel

**Search Results**:

- Fetches city suggestions from Open-Meteo Geocoding API
- Returns up to 8 results
- Groups results into "Matches" (exact name match) and "Nearby" (other results)
- Sorts by distance from user if geolocation available
- Displays each result with format: `City, State/Region, Country`

**Filter Behavior**:

- Filter tokens (e.g., `paris #france`) filter results by matching country or region codes
- If filters exclude all results, shows unfiltered results with a hint message
- Filter hint: "No matches for [tokens]. Showing broader results."

**Local vs Worldwide Toggle**:

- Default: Prefers local results (same country as user)
- If user has geolocation: Shows "nearby" results first
- Toggle button appears when both local and worldwide results exist
- Button labels:
  - "Show worldwide results" (when showing local)
  - "Prefer nearby results" or "Prefer local results" (when showing worldwide)
- Status messages indicate current mode:
  - "Showing worldwide results."
  - "No nearby matches. Showing worldwide results."
  - "Recent locations." (when showing recents)

### Keyboard Navigation

**In Search Field**:

- Arrow Down: Move to first result or next result
- Arrow Up: Move to previous result
- Home: Jump to first result
- End: Jump to last result
- Enter: Select active result (or first result if none active)
- Escape: Close results panel
- Tab: Navigation follows standard browser behavior

**In Results List**:

- Each result is keyboard focusable
- Arrow keys move between results
- Enter or Space: Select result
- Escape: Close panel and return focus to search field

### Recent Locations

- Displayed when field is empty or has fewer than 2 characters
- Shows last 5 selected locations
- Updates when a new location is selected
- Persisted in localStorage
- Labeled as "Recent" group

### Geolocation Button

**States**:

- Enabled: Location pin icon, label "Use my location"
- Disabled: Grayed out, label "Location unavailable" (if geolocation not supported)
- Loading: Disabled during geolocation request, label "Locating..."

**Behavior**:

- Click requests browser geolocation permission
- 5-second timeout for geolocation request
- On success: Reverse geocodes and auto-selects current location
- On error: Silent failure (button returns to enabled state)
- Geolocation request only triggered once per session unless explicitly clicked

### Location Selection

When a location is selected:

1. Input field updates to show: `City, State, Country` or `City, Country`
2. Stores location in localStorage as "last active"
3. Adds to recent locations list (max 5, most recent first)
4. Clears and closes results panel
5. Logs to console: `Selected city: [name]` with coordinates
6. Triggers complete daylight recalculation
7. Syncs date picker to location's timezone
8. Updates all UI elements with new data

**Current Location Handling**:

- Initially shows as "Current Location"
- Performs reverse geocoding in background via BigDataCloud API
- Updates display to actual place name when resolved
- If reverse geocoding fails, keeps "Current Location" label
- Marked with `isCurrent: true` flag and `reverseGeocodeFailed` flag if resolution failed

## Date Selection

### Date Picker

**Default Behavior**:

- Defaults to today in the selected location's timezone (not user's timezone)
- Always interprets dates in the location's timezone
- Shows "Today" button when viewing today's date

**Interaction Methods**:

1. **Clicking Calendar Popup**: Immediate selection and update
2. **Keyboard Input**:
   - Typing triggers commit after 1.2-second delay
   - Pressing Enter commits immediately
   - Pressing Tab/Shift/Alt/Control/Meta doesn't trigger commit
   - Blur (clicking outside) commits immediately
3. **Arrow Keys**: Immediate selection when using date picker arrows

**Commit Behavior**:

- On commit: Cancels any pending timeout
- Validates the date is parseable
- Stores custom date in state
- Sets `useLiveDate: false` flag
- Triggers complete daylight recalculation
- Updates all optimistic messages and milestones for the new date
- Date picker background changes to indicate custom date mode

### Today Button

**Visibility**:

- Visible when viewing any custom (non-today) date
- Hidden when viewing today

**Click Behavior**:

1. Resets to live/today mode (`useLiveDate: true`)
2. Clears custom date from state
3. Sets date picker to current date in location's timezone
4. Triggers daylight recalculation
5. Returns date picker to default visual state

### Timezone Handling

- All dates are interpreted in the **location's timezone**, not the user's timezone
- When user in New York (EST) views Paris (CET), "today" means today in Paris
- Date picker syncs to location timezone whenever location changes
- Ensures consistency: sunrise/sunset times are always local to the selected location

## Daylight Calculations

### Calculation Flow

When location or date changes:

1. Creates astronomy context for the location (latitude/longitude)
2. Calculates sun events (sunrise, sunset, daylight duration) for:
   - Today
   - 7 days ago (1 week comparison)
   - 1 month ago (1 month comparison)
3. Scans full year asynchronously to find extremes:
   - Earliest sunset date and time
   - Latest sunset date and time
   - Shortest day date and duration
   - Longest day date and duration
   - Maximum daily daylight gain date
   - Days with less daylight than today
4. Calculates seasonal dates (equinoxes, solstices)
5. Finds DST transition dates
6. Computes average winter daylight asynchronously

### Async Operations

**Why Async**:

- Full-year scans (365+ calculations) can block UI
- Astronomy Engine is computationally intensive
- Operations yield to main thread in chunks to avoid jank

**Async Functions**:

- `getYearlySunExtremesAsync()`: Scans entire year for extremes
- `getAverageWinterDaylightAsync()`: Calculates winter daylight average
- Uses `Promise` and `setTimeout` to yield between chunks

### Display Elements

**Sunset Stat**:

- **Main Value**: Today's sunset time (e.g., "5:34 PM")
- **Delta 1**: Minutes later/earlier than earliest sunset of the year
  - Shows absolute difference
  - Format: "X minutes later" or "X hours Y minutes later"
  - Tooltip shows: earliest sunset time and date
- **Delta 2**: Minutes later/earlier than 1 week/1 month ago
  - Uses week if month shows negative (avoiding discouragement)
  - Uses month if positive or zero
  - Format: "X minutes later than 1 week ago"
  - Tooltip shows: comparison sunset time and date

**Daylight Stat**:

- **Main Value**: Today's daylight duration (e.g., "9h 23m")
- **Delta 1**: Minutes longer/shorter than shortest day of the year
  - Shows absolute difference
  - Format: "X hours Y minutes longer"
  - Tooltip shows: shortest day duration and date
- **Delta 2**: Minutes longer/shorter than 1 week/1 month ago
  - Same week/month selection logic as sunset
  - Format: "X minutes longer than 1 week ago"
  - Tooltip shows: comparison daylight and date

**Comparison Mode Selection**:

- Preference: Use 1-month comparison
- Fallback: Use 1-week comparison if any month delta is negative
- Hidden: Both comparison rows hidden if negative changes detected in week view
- Prevents showing discouraging declining statistics

**Delta Tooltips**:

- Appear on hover/focus of reference text (e.g., "earliest sunset")
- Show specific time/duration and date for comparison point
- Accessible via keyboard focus
- Dismiss on blur or mouse leave

## Optimistic Messages

### Message Selection

**Input Data**:

- Current date and location
- Month (1-12)
- Hemisphere (north/south based on latitude)
- All calculated sun metrics (sunset times, daylight durations, deltas, etc.)
- Upcoming milestones list

**Selection Algorithm**:

1. Filter messages by adjusted month (hemisphere-aware)
   - Northern hemisphere: months as-is
   - Southern hemisphere: months +6 modulo 12 (seasons flipped)
2. Check `data_needs`: All required data keys must have valid values
3. Check `additional_requirements`: Comparison expressions must evaluate to true
   - Supports operators: `>`, `<`, `>=`, `<=`, `==`, `===`
   - Example: `"sunset_today > sunset_earliest"`
4. Call `getValue()` function if message has placeholders
   - Must return a positive number (or zero for specific cases)
   - Returns `null` to exclude the message
5. Fill placeholders in headline/lede with computed value
6. Replace data placeholders like `{next_milestone_title}` with actual values

**Placeholder Formats**:

- `{## minutes}`: "X minutes" or "X hours Y minutes"
- `{## days}`: "X days" or "X day"
- `{## weeks}`: "X weeks" or "X week"
- `{##%}`: "X%" (rounded percentage)

**Message Structure**:

```javascript
{
  headline: "You've gained {## minutes} of daylight since the winter solstice.",
  lede: "Loving that extra light 😎",
  months: [1, 2, 3, 4, 5],
  data_needs: ["daylight_today", "daylight_minimum"],
  additional_requirements: null,
  getValue: ({ daylight_today, daylight_minimum }) =>
    daylight_today - daylight_minimum
}
```

### Display Behavior

**Normal Case** (messages available):

1. Randomly select one of the valid messages as the first
2. Start rotation timer (15 seconds per message)
3. Rotate through valid messages sequentially
4. Fade out old message, fade in new message
5. Loop back to first message after showing all
6. Manual navigation available via Previous/Next buttons
7. Dot indicators show message count and current position

**Fallback Cases**:

1. **No Valid Messages**: Shows default headline and lede
   - Headline: "Daylight insights for [Location]"
   - Lede: Milestone-based if available, otherwise generic
2. **Polar Day** (24 hours daylight): "Polar day—24-hour daylight!"
3. **Polar Night** (0 hours daylight): "Polar night—no direct sunlight today."

**Milestone Override**:

- If a milestone occurs today (e.g., "Shortest day", "First 6pm sunset")
- Stops message rotation
- Displays milestone's `todayHeadline` and `todayLede`
- Triggers confetti animation (5-second duration)

### Rotation Behavior

**Timing**:

- First message: Shows immediately (no delay)
- Subsequent messages: 15-second intervals
- Rotation continues indefinitely
- Pauses when switching to milestone override
- Resumes if milestone override is removed (date/location change)

**Manual Navigation**:

- Previous/Next buttons for cycling through messages
- Clicking navigation buttons restarts the rotation timer
- Dot indicators show total message count and current position
- Navigation controls hidden when only one message is available
- Supports swipe/touch gestures via pointer events
- Respects `prefers-reduced-motion` for animations

**Animation**:

- Fade out: 400ms
- Fade in: 400ms
- Uses CSS transitions via class toggling
- Swap ID mechanism prevents race conditions on rapid updates

**Special Handling**:

- Text prefixes removed: "Only less than" becomes "Less than"
- Milestone title formatting for countdowns: "gained..." becomes "you've gained..."
- Lede fallback to next milestone countdown if message has no lede

## Milestones

### Milestone Types

**Static Milestones** (defined in [milestones.js](../scripts/milestones.js)):

1. **Sunset Threshold Milestones**:
   - First sunset after 4:00 PM, 4:30 PM, 5:00 PM, 5:30 PM, 6:00 PM, 7:00 PM, 8:00 PM
   - Detected by scanning forward from winter solstice to find first date sunset crosses threshold
   - Example: `id: "sunset-after-6"`, threshold: `18 * 60` (1080 minutes from midnight)

2. **Daylight Gain Milestones**:
   - Gained 30 minutes, 1 hour, 1.5 hours, 2 hours since winter solstice
   - Calculated by comparing today's daylight to winter solstice daylight
   - Example: `id: "gain-60"`, threshold: `60` minutes gained

3. **Daylight Duration Milestones**:
   - First day with 10+ hours, 11+ hours, 12+ hours of daylight
   - Example: `id: "first-10-hours"`, threshold: `10 * 60` minutes

**Computed Milestones** (calculated dynamically):

1. **Seasonal Events**:
   - Spring equinox
   - Summer solstice
   - Fall equinox
   - Winter solstice

2. **Yearly Extremes**:
   - Earliest sunset of the year
   - Shortest day of the year
   - Longest day of the year

3. **Next Half-Hour Sunset**:
   - Dynamically calculates next 30-minute increment sunset will reach
   - Example: If sunset is 5:23 PM, shows "Next 5:30 PM Sunset"
   - Skips if duplicate of another threshold milestone

4. **DST Start**:
   - Spring forward date (daylight saving time begins)
   - Only in regions that observe DST

### Milestone Card Display

**Layout**:

```
Coming up
[Milestone Title]
[Date] • [Days Away]
[Toggle Arrow →]
```

**Visibility**:

- Always visible (unless no milestones exist, which is rare)
- Shows first upcoming milestone by default
- Click arrow to cycle through upcoming milestones
- Milestone index wraps around (after last, returns to first)

**Formatting**:

- **Title**: Milestone title in sentence case
- **Date**: Long format (e.g., "Monday, March 20, 2025")
- **Days Away**:
  - "Tomorrow" (1 day)
  - "In X days" (2+ days)
  - "In X weeks" (if more than 13 days, rounds to weeks)

**Sorting**:

- Sorted by days away (ascending)
- Ties broken alphabetically by title
- Only includes milestones with positive days away (future dates)
- Milestones occurring today are excluded from carousel but trigger special behavior

### Today's Milestone Behavior

**Detection**:

- Checks if any milestone's date matches today
- Uses date comparison in location's timezone

**When Milestone is Today**:

1. **Message Override**:
   - Stops optimistic message rotation
   - Displays milestone's `todayHeadline` as main headline
   - Displays milestone's `todayLede` as lede (if provided)
   - Example: "First 6pm sunset of the year!" / "Longer evenings ahead."

2. **Confetti Celebration**:
   - Triggers on first detection of today milestone
   - 5-second animation duration
   - 200 confetti pieces
   - Random colors from warm palette
   - Pieces fall with gravity and horizontal drift
   - Self-cleaning (removes elements after animation)
   - Caches last celebrated milestone to prevent repeated triggers
   - Only triggers once per milestone per session

3. **Carousel Behavior**:
   - Today milestone excluded from carousel
   - Carousel shows next upcoming milestones
   - If no future milestones, carousel shows placeholder

**Confetti Deduplication**:

- Uses milestone ID + date as cache key
- Prevents confetti on location/date change if already celebrated
- Clears celebration on date change to allow celebration on new date

## Share Feature

### Share Modal

**Opening**:

- Click "Share Your Sunlight" button
- Captures current state snapshot (headline, lede, data)
- Opens modal dialog (HTML `<dialog>` element)
- Displays in default "Text" mode
- Generates share preview automatically

**Modes**:

1. **Text Mode** (default):
   - Shows formatted text preview
   - Displays "Copy to clipboard" button
   - Shows social media share buttons (Instagram, Facebook, X, Bluesky)

2. **Story/Image Mode**:
   - Generates 1080x1920px Instagram story image
   - Shows canvas preview
   - Displays "Download Image" button
   - Hides social share buttons
   - Uses HTML5 Canvas API for rendering

**Toggle Between Modes**:

- Buttons at top: "Text" | "Image"
- Active mode highlighted
- Switches preview area and action buttons
- Regenerates preview when switching modes

### Text Share Format

**Layout**:

```
☀️ [Location] — [Date]

[Headline]

[Progress Bar] Progress towards shortest day (X%)  [if applicable]

☀️ [Xh Ym] of daylight today
🌅 Sunset X minutes later than the earliest sunset
📈 X days until [next milestone]

SunshineOptimist.com
```

**Progress Bar**:

- Only shown in specific months/situations:
  - **Max Mode** (months 1-5): Shows percentage of maximum daylight
    - Example: `▓▓▓▓▓▓▓▓▓░ 85% of maximum daylight`
  - **Shortest Mode** (months 9-12, before winter solstice): Shows progress toward shortest day
    - Example: `▓▓▓▓▓░░░░░ Progress towards shortest day (42%)`
  - **None Mode** (months 6-8): No progress bar (summer, near maximum)
- Uses 10-character bar: `▓` for filled, `░` for empty
- Percentage rounded to nearest integer

**Dynamic Content**:

- **Location**: Respects privacy mode
- **Date**: Long format in user's locale
- **Headline**: From current optimistic message or milestone
- **Daylight**: Format "Xh Ym" (e.g., "9h 23m")
- **Sunset Delta**: Relative to earliest sunset
- **Milestone**: Next upcoming milestone with day count

### Image/Story Share Format

**Dimensions**: 1080px × 1920px (Instagram Story size)

**Visual Design**:

- **Background**: Yellow-orange-red gradient
  - Top: `#FFEB3B` (yellow)
  - Middle: `#FF9800` (orange)
  - Bottom: `#FF5722` (red)
- **Text Color**: White with subtle shadow
- **Font**: Merriweather (bold, serif)

**Content**:

```
☀️[Location]☀️

Good news! [Headline]

from SunshineOptimist.com
```

**Layout**:

- Location line: 72px font, centered vertically
- Headline: 84px font, word-wrapped to fit width
- Footer: 36px font, semi-transparent
- Padding: 80px on all sides
- Text shadow for depth
- Vertically centered as a group

**Font Loading**:

- Waits for `document.fonts.ready` before rendering
- Ensures Merriweather font is loaded for consistent rendering

### Privacy Mode

**Toggle**:

- Checkbox: "Share as 'My Location'"
- State saved to localStorage
- Persists across sessions

**When Enabled**:

- Location displays as "My Location" (instead of actual city name)
- Applies to both text and image share formats
- Does not affect the main app display

**When Disabled**:

- Location displays actual city name
- Format: `City, State, Country` or `City, Country`
- "Current Location" resolves to actual place name via reverse geocoding

### Copy to Clipboard

**Behavior**:

1. Generates share text if not already cached
2. Uses `navigator.clipboard.writeText()`
3. On success: Button label flashes "Copied!" for 1.2 seconds
4. On failure: Silent (no error shown to user)
5. Returns to original label after flash

**Browser Compatibility**:

- Checks for `navigator.clipboard.writeText` support
- Gracefully fails if unsupported (returns false, no flash)

### Social Share Buttons

**Mobile Devices with Web Share API Support**:

- Detects mobile device (user agent, touch, screen width)
- Checks for Web Share API support (`navigator.share`)
- Shows "Share" button instead of individual social buttons
- Uses native sharing via `navigator.share()` with share text
- For images, can share files via `navigator.share({ files: [...] })`
- Provides native mobile sharing experience across all apps

**Desktop and Unsupported Mobile Devices**:

**Instagram**:

- Copies text to clipboard
- Opens Instagram.com in new tab
- User must paste manually (Instagram doesn't support URL parameters)

**Facebook**:

- Opens Facebook Share dialog with:
  - URL: `https://sunshineoptimist.com`
  - Quote: Share text
- Opens in new window with `noopener,noreferrer`

**X (Twitter)**:

- Opens Tweet compose with pre-filled text
- URL: `https://twitter.com/intent/tweet?text=[encoded]`
- Opens in new window

**Bluesky**:

- Opens Bluesky compose with pre-filled text
- URL: `https://bsky.app/intent/compose?text=[encoded]`
- Opens in new window

### Download Image

**Behavior**:

1. Converts canvas to PNG blob
2. Creates temporary object URL
3. Triggers download with filename: `sunshine-optimist-story.png`
4. Cleans up object URL after download
5. On failure: Console warning (no user-facing error)

**File Format**:

- PNG (maximum quality, 1.0 compression)
- Full resolution (1080x1920px)

### Closing Modal

**Methods**:

1. Click "Close" button
2. Click backdrop (outside modal)
3. Press Escape key

**Cleanup**:

- Clears modal snapshot state
- Resets to "Text" mode
- Closes dialog element
- Returns focus to trigger button

## Progressive Web App (PWA)

### Installation

**Manifest**:

- Name: "Sunshine Optimist"
- Short Name: "Sunshine"
- Display: Standalone (no browser UI)
- Orientation: Portrait
- Theme Color: `#e69522` (orange)
- Background: `#fffbf0` (warm cream)
- Icon: SVG favicon (scalable, works as maskable icon)

**Installation Criteria**:

- Meets PWA criteria: HTTPS, manifest, service worker
- Browser may show "Add to Home Screen" prompt
- Can be installed on mobile/desktop

**Installed Behavior**:

- Opens as standalone app (no browser chrome)
- Uses theme color for system UI
- Portrait orientation locked on mobile
- App icon appears on home screen/app launcher

### Service Worker

**Caching Strategy**:

1. **Static Assets** (cache-first):
   - HTML, CSS, JavaScript files
   - Astronomy engine
   - All app modules
   - On cache miss: Fetch from network and cache
   - On network failure: Return cached version
   - On navigation failure: Return cached index.html (offline page)
   - Only caches same-origin requests

2. **API Requests**:
   - No service worker caching
   - All API calls go directly to network
   - Allows for fresh data on every request

3. **External Resources** (network-only):
   - Google Fonts
   - Other CDN resources
   - Relies on their own caching headers

**Cache Versioning**:

- Cache name: `sunshine-optimist-static-v{commit-count}-{short-hash}` (e.g., `v104-093e845`)
- Version auto-updated by git pre-commit hook
- On version bump: Old caches automatically deleted
- Activates immediately via `skipWaiting()`
- Takes control via `clients.claim()`

**Offline Behavior**:

- Static assets available offline
- Last-selected location and date work offline
- New city searches and reverse geocoding require network connection
- Graceful degradation: Shows last known state

### Storage

**localStorage Keys**:

- `sunshine-optimist:recent-locations`: Array of last 5 locations
- `sunshine-optimist:last-location`: Last selected location object
- `sunshine-optimist:share-privacy`: Boolean for privacy toggle

**Data Persisted**:

- Recent locations (max 5)
- Last active location
- Share privacy preference
- Does NOT persist: Custom date, message rotation state, milestone index

**Data Format**:

- JSON serialization
- Graceful handling of parse errors (returns default/empty)
- Console warnings for invalid data

## Accessibility

### Keyboard Navigation

**All Interactive Elements**:

- Fully keyboard accessible
- Standard tab order
- Visible focus indicators
- Focus trapping in modals

**Location Search**:

- Arrow keys navigate suggestions
- Enter/Space select
- Escape closes
- Home/End jump to first/last

**Date Picker**:

- Native HTML date input (browser-provided accessibility)
- Enter commits selection
- Tab navigation works

**Milestone Toggle**:

- Space/Enter activate
- Cycles through milestones

**Share Modal**:

- Escape closes
- Tab order: mode buttons → privacy toggle → preview → action buttons → close
- Focus returns to trigger on close

### Screen Readers

**ARIA Labels**:

- Location search: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`
- Results list: `role="listbox"`, `aria-label="City suggestions"`
- Result options: `role="option"`, `aria-selected`
- Live regions: `role="status"`, `aria-live="polite"` for search status
- Modal: `aria-labelledby` for title

**Semantic HTML**:

- `<header>`, `<section>`, `<dialog>` for structure
- `<button>` for all clickable actions
- `<label>` for form inputs
- `<h1>` for main headline
- Proper heading hierarchy

**Hidden Elements**:

- Decorative icons: `aria-hidden="true"`
- Confetti: `aria-hidden="true"`
- Tooltips update content on associated elements

### Visual Accessibility

**Color Contrast**:

- Text on backgrounds meets WCAG AA standards
- Primary text: Dark on light background
- Button states have sufficient contrast

**Focus Indicators**:

- Visible focus rings on all interactive elements
- Increased size/color on focus
- Never suppressed

**Text Sizing**:

- Relative units (rem/em) for text
- Scales with browser text size settings
- No text smaller than 14px base

## Edge Cases and Error Handling

### Location Errors

**Geolocation Denied**:

- Silent failure
- Falls back to default location
- Button returns to enabled state
- User can manually search for city

**Geolocation Timeout**:

- 5-second timeout
- Falls back to default location
- No error message shown

**Reverse Geocoding Failure**:

- Falls back to "Current Location" label
- Sets `reverseGeocodeFailed: true` flag
- Location still functional for calculations
- Does not retry automatically

**City Search API Failure**:

- Shows error message: "Could not fetch city suggestions. Check your connection and try again."
- Displays "Retry search" button
- Aborts pending requests on new input
- Clears results on error

**Empty Search Results**:

- Shows message: "No matches yet."
- Offers toggle to worldwide results if applicable
- Recent locations still accessible

**Invalid Search Input**:

- Less than 2 characters: Shows recent locations
- Invalid characters: Passed to API (API handles sanitization)
- Filter tokens with no matches: Shows unfiltered results

### Date Errors

**Invalid Date Input**:

- Browser validation prevents invalid dates
- Out-of-range dates handled by browser
- Malformed input: Falls back to today

**Date Picker Browser Differences**:

- Format varies by browser/locale
- Native date picker UI differs
- Always uses `type="date"` HTML input
- Value always in YYYY-MM-DD format internally

**Timezone Edge Cases**:

- Dates always in location's timezone
- Handles DST transitions correctly
- Leap years supported
- Dates near year boundaries handled correctly

### Calculation Errors

**Polar Regions**:

- **Polar Day** (24-hour daylight):
  - Headline: "Polar day—24-hour daylight!"
  - Stats may show "—" for sunset
  - Milestones may not apply
- **Polar Night** (0-hour daylight):
  - Headline: "Polar night—no direct sunlight today."
  - Stats may show "—" for sunrise/sunset
  - Milestones may not apply

**Missing Data**:

- If astronomy calculation fails: Shows "—" placeholder
- If delta cannot be calculated: Hides comparison row
- If no valid messages: Shows fallback headline and lede

**Extreme Dates**:

- Supports dates far in past/future
- Year range limited by JavaScript Date limits (approx. ±275,000 years)
- Astronomy Engine handles dates within reasonable human range

### Storage Errors

**localStorage Unavailable**:

- Private browsing mode: localStorage may throw errors
- Quota exceeded: Old entries cleared automatically
- Graceful fallback: App works without persistence

**Corrupted Data**:

- JSON parse errors: Console warning, returns default
- Invalid location objects: Ignored, falls back to default
- Malformed recent locations: Cleared and reset

### Network Errors

**API Unavailable**:

- Geocoding API down: Shows error, offers retry
- Reverse geocoding down: Falls back to "Current Location"
- Service worker serves cached API responses if available

**Slow Network**:

- Debouncing prevents redundant requests
- Request deduplication for reverse geocoding
- Loading states shown during requests
- Timeout handling for geolocation (5s)

**Offline Mode**:

- Static app shell cached and available
- Last location and calculations work
- New searches fail gracefully
- Service worker provides stale data if cached

## Performance Optimizations

### Lazy Loading

**Astronomy Calculations**:

- Astronomy Engine loaded on page load (required immediately)
- Full-year scans done asynchronously to avoid blocking
- Results cached by astronomy utils layer

### Caching

**Astronomy Cache**:

- Sun events cached by date parts key
- Yearly extremes cached by year and approximate daylight
- Seasonal dates cached by year
- Cache invalidated on location change

**Reverse Geocoding Cache**:

- Results cached by coordinate key (lat,lon to 4 decimals)
- Single in-flight request per cache key
- Duplicate requests await same promise
- Cache cleared on location change or coordinate update

**Service Worker Cache**:

- Static assets cached on install
- No API response caching (all API calls go to network)

### Debouncing

**Search Input**: 250ms debounce on keystrokes
**Date Input**: 1.2s debounce on typing, immediate on blur/enter
**Message Rotation**: 15s interval (not debounced)

### Request Deduplication

**Geocoding**: AbortController cancels previous requests on new input
**Reverse Geocoding**: Single promise per coordinate set, shared across callers
**Date Changes**: Commit timeout cleared on rapid changes

### DOM Updates

**Efficient Rendering**:

- Direct DOM updates via helper functions (no virtual DOM)
- Batch updates where possible
- CSS transitions for animations (GPU-accelerated)
- Tooltips created once, content updated

**Async Rendering**:

- Canvas generation for story images uses async/await
- Font loading waits for fonts.ready
- Confetti animation uses requestAnimationFrame

## Browser Compatibility

### Minimum Requirements

**JavaScript**:

- ES Modules (import/export)
- Async/await
- Optional chaining (`?.`)
- Nullish coalescing (`??`)
- Modern browsers: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+

**Web APIs**:

- Fetch API
- Navigator.geolocation
- Navigator.permissions
- localStorage
- HTML5 Canvas
- Dialog element (with fallback)
- Clipboard API (graceful degradation)

**CSS**:

- CSS Grid
- CSS Custom Properties (variables)
- CSS Transitions
- Flexbox

### Graceful Degradation

**No Geolocation**: Falls back to default location
**No Clipboard API**: Copy button hidden or non-functional
**No Service Worker**: App works but no offline support
**No Dialog Element**: Uses setAttribute fallback
**No Permissions API**: Skips permission check, user manually grants geolocation

### Testing

**Unit Tests**: test files (Vitest)

- Date utilities, message selection, state management
- Location utilities, formatters, services
- UI components, controllers
- Web Share API utilities

**E2E Tests**: 6 test files (Playwright)

- App loading and initialization
- Date selection and timezone handling
- Default location loading
- Milestone tooltips
- Location search and selection
- Share modal functionality (text and image modes)

## Debug Tools

### Console Logging

**Automatic Logs**:

- Service worker: Cache operations, activation
- Location selection: "Selected city: [name]" with coordinates
- Storage errors: JSON parse failures
- Optimistic messages: Full list on page load, location/date change

**Log Format**:

```
Optimistic messages for [Location] on [Date]:
┌───────┬─────────────────────────────────────────┐
│ index │ headline                                 │
├───────┼─────────────────────────────────────────┤
│ 0     │ You've gained 2 hours of daylight...   │
│ 1     │ Today's sunset is 47 minutes later...  │
└───────┴─────────────────────────────────────────┘
```

### Debug API

**Global Object**: `window.SunshineOptimistDebug`

**Methods**:

1. **`getOptimisticMessages()`**:
   - Returns last computed optimistic message data
   - Structure:
     ```javascript
     {
       validOptions: [],      // Messages that passed all filters
       displayedOptions: [],  // Messages actually displayed (or fallback)
       data: {},              // Input data for message selection
       month: 3,              // Current month
       hemisphere: "north",   // Current hemisphere
       reason: "ok",          // Reason code: "ok", "fallback", or "polar"
       lastUpdatedAt: Date    // When this was last computed
     }
     ```

2. **`printOptimisticMessages()`**:
   - Prints formatted table to console
   - Returns same data as `getOptimisticMessages()`
   - Uses `console.table()` if available

**Usage**:

```javascript
// In browser console:
SunshineOptimistDebug.printOptimisticMessages();
SunshineOptimistDebug.getOptimisticMessages();
```

## Notable Implementation Details

### Hemisphere Adjustment

- Month values adjusted for southern hemisphere: `(month + 6) % 12`
- Flips seasons: January in northern hemisphere = July adjusted month in southern
- Ensures seasonal messages appropriate for each hemisphere
- Example: "Days are getting longer!" shows in Jan (north) and July (south)

### Timezone Consistency

- All date operations use location's timezone, not user's
- `getActiveDateParts()` always returns parts in location timezone
- Prevents confusion when user in different timezone than location
- Critical for accurate sunrise/sunset times

### Message Rotation Randomization

- First message selected randomly from valid options
- Subsequent messages follow sequential order
- Prevents always seeing same message first
- Improves user experience on repeated visits

### Milestone Deduplication

- Next half-hour sunset milestone skipped if duplicate of threshold milestone
- Prevents showing "Next 6:00 PM Sunset" and "First sunset after 6pm" for same date
- Checks date equality, not just threshold value

### Confetti Single-Trigger

- Uses cache key: `${milestone.id}:${dateParts.year}-${dateParts.month}-${dateParts.day}`
- Prevents confetti on every render
- Clears on date change to allow celebration on different dates
- Timeout auto-stops confetti after 5 seconds

### Share Text Caching

- Share text cached in state after first generation
- Reused for copy operations
- Cleared on modal close
- Prevents redundant async operations
- Ensures consistency between copy and display

### Async Astronomy Operations

- `getYearlySunExtremesAsync()`: Yields every 30 iterations
- `getAverageWinterDaylightAsync()`: Yields every 7 days of calculations
- Prevents blocking main thread during heavy calculations
- Uses `await new Promise(resolve => setTimeout(resolve, 0))`
- Essential for smooth UI during page load and location changes
