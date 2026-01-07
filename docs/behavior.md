# Application Behavior

This document describes the user interactions and behaviors of Sunshine Optimist.

## Initial Load

### First-Time User

1. Checks browser geolocation permission
2. If granted: requests coordinates, reverse-geocodes to place name, selects location
3. If denied: falls back to stored location, then browser region, then New York City
4. Displays today's date, calculates sun metrics, shows optimistic headline and stats

### Returning User

1. Loads last-used location from localStorage
2. Loads recent locations list (up to 5)
3. Loads share privacy preference
4. If last location was "Current Location" and permission granted, updates coordinates

## Location Search

### Input Behavior

- Minimum 2 characters to trigger search
- 250ms debounce before API call
- Supports filter tokens: `#region`, `#country`, `#admin` to filter results
- Escape closes results panel

### Results

- Up to 8 results from Open-Meteo Geocoding API
- Grouped into "Matches" (exact name) and "Nearby" (other results)
- Sorted by distance if geolocation available
- Local vs worldwide toggle available

### Keyboard Navigation

- Arrow keys: navigate results
- Home/End: jump to first/last
- Enter: select active result
- Escape: close panel

### Recent Locations

- Shown when field is empty or has fewer than 2 characters
- Last 5 selected locations, persisted in localStorage

### Geolocation Button

- Click requests browser permission
- 5-second timeout
- On success: reverse-geocodes and selects current location
- On error: silent failure, returns to enabled state

### Location Selection

When selected:

1. Updates input field with city name
2. Stores in localStorage as "last active" and adds to recents
3. Triggers daylight recalculation
4. Syncs date picker to location's timezone

## Date Selection

### Date Picker

- Defaults to today in the location's timezone (not user's timezone)
- Calendar popup: immediate selection
- Keyboard input: 1.2s debounce, immediate on Enter or blur
- "Today" button appears when viewing a custom date

### Timezone Handling

All dates are interpreted in the **location's timezone**, not the user's. When viewing Paris from New York, "today" means today in Paris.

## Daylight Display

### Stats

**Sunset stat**:

- Main value: today's sunset time
- Delta 1: difference from earliest sunset of the year
- Delta 2: difference from 1 week or 1 month ago (uses week if month is negative)

**Daylight stat**:

- Main value: today's daylight duration
- Delta 1: difference from shortest day of the year
- Delta 2: difference from 1 week or 1 month ago

**Delta tooltips**: Hover/focus shows specific comparison time and date.

## Optimistic Messages

### Selection

Messages are filtered by:

1. Adjusted month (hemisphere-aware: southern hemisphere months +6 mod 12)
2. Required data keys (`data_needs`)
3. Optional comparison expressions (`additional_requirements`)
4. Positive return value from `getValue()` function

### Display

- Multiple valid messages: rotates every 12 seconds with fade animation
- First message selected randomly, then sequential
- No valid messages: shows fallback headline
- Polar day/night: shows special message
- Milestone today: overrides with milestone copy and triggers confetti

## Milestones

### Types

**Static** (from `milestones.js`):

- Sunset thresholds: first sunset after 4pm, 4:30pm, 5pm, 5:30pm, 6pm, 7pm, 8pm
- Daylight gains: 30min, 1hr, 1.5hr, 2hr since winter solstice
- Daylight duration: first 10hr, 11hr, 12hr day

**Computed** (from `daylight-controller.js`):

- Equinoxes and solstices
- Earliest sunset, shortest day, longest day
- Next half-hour sunset
- DST start

### Milestone Card

- Shows first upcoming milestone
- Click arrow to cycle through upcoming milestones
- Format: title, date, days away

### Today's Milestone

- Stops message rotation, displays milestone headline
- Triggers confetti (5 seconds, cached to prevent repeat triggers)
- Milestone excluded from carousel

## Share Feature

### Text Mode (default)

Format:

```
☀️ [Location] — [Date]
[Headline]
[Progress bar if applicable]
☀️ [Daylight duration]
🌅 Sunset delta
📈 [Days until milestone]
SunshineOptimist.com
```

- Copy to clipboard button
- Social share links: Instagram (copy), Facebook, X/Twitter, Bluesky

### Image Mode

- 1080x1920px Instagram Story image
- Warm gradient background with headline and location
- Download as PNG

### Privacy Mode

- Toggle: "Share as 'My Location'"
- Persisted in localStorage
- Applies to both text and image modes

### Closing

- Click Close, backdrop, or press Escape
- Resets to Text mode

## Offline Support

- Static assets cached on install
- API responses cached for 24 hours
- Last-selected location works offline
- New city searches require network

## Edge Cases

### Location Errors

- Geolocation denied/timeout: falls back to default location
- Reverse geocoding failure: shows "Current Location" label
- API failure: shows error with retry button
- Empty results: shows "No matches yet"

### Calculation Edge Cases

- Polar day (24hr daylight): special headline
- Polar night (0hr daylight): special headline
- Missing data: shows "—" placeholder

### Storage Errors

- localStorage unavailable: app works without persistence
- Corrupted data: cleared and reset to defaults

## Debug Tools

Console logs optimistic messages on load and location/date changes.

Global object `window.SunshineOptimistDebug`:

- `printOptimisticMessages()`: prints current messages to console
- `getOptimisticMessages()`: returns last computed data
