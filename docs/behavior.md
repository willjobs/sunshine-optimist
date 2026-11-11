# Application Behavior

This document describes the user interactions and behaviors of Sunshine Optimist.

## Initial Load

### First-Time User

1. Checks browser geolocation permission
2. If granted: requests coordinates, reverse-geocodes to place name, selects location
3. If denied or unavailable: looks up Boston, Massachusetts, then uses built-in Boston coordinates if that lookup fails
4. Displays today's date, calculates sun metrics, shows optimistic headline and stats

### Returning User

1. Loads last-used location from localStorage
2. Loads recent locations list (up to 5)
3. Loads share privacy preference
4. If the last location came from geolocation and permission is granted, refreshes its coordinates and place name
5. Invalid saved locations are removed; valid recent locations are retained

## Location Search

### Input Behavior

- Minimum 2 characters to trigger search
- 250ms debounce before API call
- A comma followed by a region or country filters results (for example, `Paris, France`)
- Changing the query immediately clears suggestions from the previous query
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
- The "Find cities with milestones" action is available even when there are no recent locations

### Explore Milestones in Other Cities

- A persistent action below the milestone card scans major cities for milestones on the active date in each city's timezone
- Results appear beside the milestone card with the city and milestone name; selecting one changes the active city
- Closing the panel or changing the date or location cancels an unfinished scan
- The city search field keeps its current value until a result is selected

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
- Keyboard input: 300ms debounce, immediate on Enter or blur
- "Today" button appears when viewing a custom date
- In Today mode, the display refreshes at midnight in the selected location and when a suspended tab becomes visible again

### Timezone Handling

All dates are interpreted in the **location's timezone**, not the user's. When viewing Paris from New York, "today" means today in Paris.

## Daylight Display

### Stats

**Sunset stat**:

- Main value: today's sunset time
- Gain badge: subline badge showing how much later today's sunset is than yesterday, formatted as "+1m 13s since yesterday" (hidden when zero or negative; shows seconds-only under 1 minute)
- Delta 1: difference from earliest sunset of the year
- Delta 2: difference from 1 week or 1 month ago (uses week if month is negative)

**Daylight stat**:

- Main value: today's daylight duration
- Gain badge: subline badge showing how much more daylight today has than yesterday, formatted as "+1m 13s since yesterday" (hidden when zero or negative; shows seconds-only under 1 minute)
- Delta 1: difference from shortest day of the year
- Delta 2: difference from 1 week or 1 month ago

**Delta tooltips**: Hover/focus shows specific comparison time and date.

## Optimistic Messages

### Selection

Messages are filtered by:

1. Adjusted month (hemisphere-aware: southern hemisphere months +6 mod 12)
2. Required data keys (`data_needs`)
3. Optional measured-season and multi-condition predicates (`when`)
4. Raw unrounded values from `getValue()` meet the message-specific minimum and maximum thresholds
5. If multiple valid messages share the same non-null `group`, only one is kept: the one with the highest `getValue()` result, except `milestone_countdown`, which keeps the nearest event; eligible acceleration has priority over generic weekly gain
6. The final list is capped

### Copy constraints

- Sunset comparisons require 10 minutes above winter's earliest (after its turn), 30 minutes above January 1, or 15 minutes above last month (after winter, with days lengthening)
- Monthly/cumulative daylight gain and the two-week forecast require 15 minutes; daylight after 5pm requires 30 minutes
- Month-end must be future, at least 30 minutes above the minimum and 10 minutes above today
- Comparisons above the shortest day and average winter day require 90 minutes
- Weekly gain requires 10 minutes; today's gain requires one minute. Acceleration additionally requires increasing measured weekly gains before local spring equinox
- Annual daylight decrease progress requires 75% completed and shortening days; loss slowdown requires a 25% reduction between equal seven-day windows four weeks apart
- Regained daylight requires 25% of a seasonal range of at least one hour, with days lengthening
- Late-evening copy requires at least two full weeks of sunsets after 7pm; daylight percentile requires 60%; near-longest requires a gap at most 30 minutes before summer solstice
- Dedicated turnaround countdowns are limited to 35 days; the largest-increase countdown is limited to 42 days
- The rear-view message appears for the first 14 days after the shortest day, while lengthening
- Remaining loss, percentage of time toward shortest day, and weekly loss headlines are retired

### Display

- Multiple valid messages: rotates every 15 seconds with fade animation
- First message selected randomly, then sequential
- Dot indicators are clickable/tappable to jump to a specific message; clicking a dot resets the rotation timer
- No valid messages: shows fallback headline
- Polar day/night: shows special message
- Milestone today: overrides with milestone copy and triggers confetti

## Milestones

### Types

**Static** (from `milestones.js`):

- Sunset thresholds: first sunset after 4pm, 4:30pm, 5pm, 5:30pm, 6pm, 7pm, 8pm
- Daylight gains: 30min, 1hr, 1.5hr, 2hr since winter solstice
- Daylight duration: first 10hr, 11hr day

**Computed** (from `daylight-controller.js`):

- Equinoxes and solstices
- Later sunsets begin, longer days begin, longest day of the year
- First 12hr day
- 10 darkest weeks behind you (actual 70 least-daylight dates)
- Next half-hour sunset, including its crossing-day celebration
- DST start

### Milestone Card

- Shows first upcoming milestone
- Click arrow to cycle through upcoming milestones
- Format: title, date, days away

### Today's Milestone

- Stops message rotation, displays milestone headline; sunrise return and winter turnarounds take priority over simultaneous events
- Triggers confetti (5 seconds, cached to prevent repeat triggers)
- Celebratory milestone excluded from carousel
- First sunset after midnight sun remains an informational card on its return day; it cannot trigger confetti, a headline, or an optimistic shared countdown
- Winter turning points use actual local daily increases, with quantified positive two-week outlooks
- Compact titles and full countdown sentences are separate fields

## Share Feature

### Text Mode

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
- On supported mobile browsers, the system share sheet is available

### Image Mode (default)

- 1080x1920px Instagram Story image
- Warm gradient background with headline and location
- Download as PNG

### Privacy Mode

- Toggle: "Share as 'My Location'"
- Persisted in localStorage
- Applies to both text and image modes

### Closing

- Click Close, backdrop, or press Escape
- Resets to Image mode

## Offline Support

- Static assets cached on install
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
- Invalid saved locations: removed and replaced with the default location
- Invalid recent entries: discarded while valid entries are kept

## Debug Tools

Console logs optimistic messages on load and location/date changes.

Global object `window.SunshineOptimistDebug`:

- `printOptimisticMessages()`: prints current messages to console
- `getOptimisticMessages()`: returns last computed data
