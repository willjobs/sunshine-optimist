# Sunshine Optimist - Current Behavior Documentation

This document describes the current behavior of the Sunshine Optimist application from a user's perspective. It is implementation-agnostic and serves as a specification to ensure functionality is preserved during refactoring.

## Overview

Sunshine Optimist is a web application that displays optimistic messages about daylight and sunset times for any city and date. Its goal is to help users appreciate daylight, particularly during darker months, by highlighting positive aspects of sunrise and sunset timing.

---

## Core Features

### 1. Location Selection

#### 1.1 City Search
- Users can search for any city worldwide using the location input field
- Search begins after typing at least 2 characters (with a 250ms debounce)
- Results are fetched from the Open-Meteo geocoding API
- Results are displayed in a dropdown panel with up to 8 suggestions

#### 1.2 Search Results Grouping
- Results are separated into two groups:
  - **Matches**: Cities whose names start with the search query
  - **Nearby**: Cities that don't match the name query but are nearby (when geolocation is active)
- Group labels only appear when both groups have results

#### 1.3 Region Filtering
- Users can filter results by region using comma-separated tokens (e.g., "Boston, MA")
- US state abbreviations are expanded to full names for matching (e.g., "CA" matches "California")
- If no results match the filter, broader results are shown with a hint message

#### 1.4 Local vs Worldwide Results
- By default, results from the user's country (based on browser locale) are shown first
- A toggle button allows switching between "local" and "worldwide" results
- When user geolocation is available, local results are labeled "nearby" and sorted by distance
- If no local results exist, worldwide results are shown with an explanatory message

#### 1.5 Geolocation
- A geolocation button allows users to detect their current location
- When geolocation is successful:
  - The app attempts to reverse-geocode coordinates to get a human-readable place name
  - If reverse geocoding fails, "Current Location" is displayed
  - Search results are sorted by distance from the user's location
- The geolocation button is disabled while location is being fetched

#### 1.6 Recent Locations
- The last 5 selected locations are saved to localStorage
- Recent locations are displayed when the search field is focused but empty
- Each location is stored with full metadata (name, region, country, coordinates, timezone)

#### 1.7 Active Location Persistence
- The currently selected location is saved to localStorage
- On page reload, the previously selected location is restored
- If no saved location exists and geolocation is already granted, the user's location is auto-detected
- If geolocation is not available/granted, Boston, MA is used as the default

#### 1.8 Location Display Format
- For US locations: "City, State" (e.g., "Boston, MA")
- For non-US locations: "City, Region, Country" (e.g., "London, England, United Kingdom")
- US state names are abbreviated (California -> CA)

### 2. Date Selection

#### 2.1 Date Picker
- A date input allows users to select any date (past or future)
- By default, the app shows data for today's date
- The date picker uses the native HTML date input

#### 2.2 Date Behavior
- Date changes trigger a recalculation of all daylight data
- A "Today" button appears when a custom date is selected
- Clicking "Today" resets to the current date
- Date selection has a 300ms commit delay to avoid excessive recalculations during input
- Keyboard input has an 800ms grace period before committing

#### 2.3 Timezone Handling
- All dates are evaluated in the **selected location's timezone**, not the user's
- This ensures accurate sunrise/sunset times for the location being viewed

### 3. Daylight Statistics Display

#### 3.1 Sunset Information
- **Current Sunset Time**: The time of sunset for the selected date and location
- **Delta from Earliest Sunset**: How many minutes later/earlier than the earliest sunset of the year
- **Delta from Comparison Period**: How many minutes later/earlier than 1 month ago (or 1 week ago as fallback)

#### 3.2 Daylight Duration Information
- **Daylight Duration**: Total hours and minutes of daylight for the selected date
- **Delta from Shortest Day**: How many minutes longer/shorter than the shortest day of the year
- **Delta from Comparison Period**: How many minutes longer/shorter than 1 month ago (or 1 week ago)

#### 3.3 Comparison Period Logic
- Default comparison is "1 month ago"
- If the month comparison shows negative values (days getting shorter), the app falls back to week comparison
- If both month and week comparisons are negative, the comparison rows are hidden

#### 3.4 Delta Tooltips
- Reference labels ("earliest sunset", "shortest day", etc.) have interactive tooltips
- Tooltips show the actual date and value being compared to
- Tooltips can be triggered by:
  - Hover (mouse/pen)
  - Touch/tap (mobile)
  - Keyboard (Enter/Space to toggle, Escape to close)
- Only one tooltip can be open at a time

### 4. Optimistic Messages

#### 4.1 Message Display
- A headline and lede (subheadline) are displayed prominently
- Messages rotate every 15 seconds with a fade animation
- Animation respects prefers-reduced-motion settings

#### 4.2 Message Selection
- Messages are filtered based on:
  - **Month**: Each message is valid for specific months (1-12)
  - **Hemisphere**: Months are adjusted for southern hemisphere (shifted by 6 months)
  - **Data Requirements**: Messages specify which data fields they need
  - **Additional Requirements**: Optional conditions (e.g., "sunset_today > sunset_earliest")
- Only messages meeting all criteria are shown

#### 4.3 Message Placeholders
- Messages can contain placeholders like `{## minutes}` or `{## days}`
- Placeholders are replaced with calculated values
- Formatting rules:
  - Minutes > 60: "X hrs Y mins"
  - Minutes <= 60: "X minutes" / "1 minute"
  - Days > 14: "less than X weeks"
  - Days <= 14: "X days" / "1 day"
  - Percentages: rounded to whole numbers with % symbol

#### 4.4 Fallback Messages
- **Polar regions**: When there's no sunrise/sunset: "Sunlight looks different here. No sunrise or sunset today."
- **No valid messages**: "Enjoy the daylight today. Every bit of sunshine helps."

#### 4.5 Message Categories
Messages cover various positive aspects including:
- Sunset time comparisons (vs earliest, vs month ago, vs year start)
- Daylight duration gains
- Days/weeks until milestones
- Percentage of daylight regained/lost
- Daily/weekly gain rates
- Comparisons to winter solstice and average winter daylight

### 5. Milestones

#### 5.1 Milestone Display
- A "Coming up" card shows the next upcoming milestone
- Users can cycle through upcoming milestones using an arrow button
- Each milestone shows: title, date, and days until it occurs

#### 5.2 Days Away Formatting
- 1 day: "(1 day away)"
- 2-14 days: "(X days away)"
- 15+ days: "(< X weeks away)" where X is rounded up

#### 5.3 Milestone Types

**Sunset Threshold Milestones** (from previous winter solstice):
- First sunset after 4:30pm
- First sunset after 5:00pm
- First sunset after 5:30pm
- First sunset after 6:00pm
- First sunset after 7:00pm
- First sunset after 8:00pm

**Daylight Gain Milestones** (from previous winter solstice):
- Gained 30 minutes of daylight
- Gained 1 hour of daylight
- Gained 1.5 hours of daylight
- Gained 2 hours of daylight

**Dynamic Milestones**:
- Next half-hour sunset (e.g., "Next 5:30pm Sunset")
- Earliest sunset of the year
- Shortest day of the year
- Longest day of the year
- Spring equinox
- Daylight savings time starts
- First day with at least 12 hours of daylight

#### 5.4 Milestone Day Behavior
- When the selected date matches a milestone:
  - The optimistic message is replaced with milestone-specific copy
  - Confetti animation is triggered
  - The milestone is not shown in "upcoming" (only future milestones appear)

#### 5.5 Confetti Animation
- 72 confetti pieces in 6 colors
- Pieces have random sizes (6-12px), durations (3.2-5s), delays, and drift patterns
- Confetti is cleaned up after the longest animation completes

### 6. Share Feature

#### 6.1 Share Modal
- A "Share Your Sunlight" button opens a modal dialog
- The modal displays a text preview of the share content
- Users can toggle "Share as My Location" for privacy

#### 6.2 Share Content Format
```
[sun emoji] [Location] — [Date]

[Headline message]

[Progress bar] [Progress text (when applicable)]

[sun emoji] [Daylight duration] of daylight today
[sunset emoji] Sunset [X mins] later than the earliest sunset
[chart emoji] [Days] until [next milestone]

SunshineOptimist.com
```

#### 6.3 Progress Bar
- Visual progress bar using Unicode blocks (█ for filled, ░ for empty)
- 20 characters wide
- Shows either:
  - Progress toward maximum daylight (when days are lengthening)
  - Progress toward shortest day (Sep-Dec when days are shortening)
  - Nothing (Jun-Aug during peak daylight)

#### 6.4 Share Actions
- **Copy to clipboard**: Copies the text
- **Instagram**: Copies text and opens Instagram (for manual paste)
- **Facebook**: Opens Facebook share dialog with prefilled text
- **X (Twitter)**: Opens tweet compose with prefilled text
- **Bluesky**: Opens Bluesky compose with prefilled text

#### 6.5 Privacy Toggle
- When enabled, location is shown as "My Location" instead of the actual city
- Preference is saved to localStorage

### 7. Visual Design

#### 7.1 Layout
- Single-page application with responsive design
- Maximum width of 900px, centered
- Header with logo, location search, and date picker
- Main card with headline, stats, and milestone
- Share button at bottom

#### 7.2 Animations
- Message rotation: fade out (320ms) → text swap → fade in
- Confetti: falling animation with rotation and drift
- All animations respect prefers-reduced-motion

### 8. Accessibility

#### 8.1 Keyboard Navigation
- Location search: Arrow keys to navigate, Enter to select, Escape to close
- Milestone toggle: Focusable button
- Share modal: Tab navigation, Escape to close
- Tooltips: Enter/Space to toggle, Escape to close

#### 8.2 ARIA Attributes
- Location search uses combobox pattern
- Results list uses listbox/option roles
- Live regions for status updates
- Expanded states for dropdowns and modals

#### 8.3 Screen Reader Support
- Tooltips build descriptive aria-labels combining visible text and tooltip content
- Visual-only elements have aria-hidden
- Status messages use aria-live regions

### 9. Data Storage

#### 9.1 localStorage Keys
- `sunshine-optimist:recent-locations`: Array of up to 5 recent locations
- `sunshine-optimist:active-location`: Currently selected location
- `sunshine-optimist:share-privacy`: Boolean for privacy toggle preference

### 10. External Dependencies

#### 10.1 APIs
- **Open-Meteo Geocoding API**: City search and timezone lookup
- **BigDataCloud Reverse Geocoding API**: Coordinates to place name conversion

#### 10.2 Libraries
- **Astronomy Engine**: Solar calculations (sunrise, sunset, equinoxes, solstices)

---

## Edge Cases and Special Behavior

### Polar Regions
- When no sunrise or sunset occurs on a given date, special messaging is displayed
- Statistics show "—" for unavailable values

### Hemisphere Handling
- Southern hemisphere locations have months adjusted by 6 for message selection
- This ensures seasonally appropriate messages (e.g., "winter" messages in June for Australia)

### DST Transitions
- Timezone offset changes are detected and handled properly
- Dates around DST transitions calculate correctly

### Leap Years
- Year length calculations account for leap years (365 or 366 days)

### Year Boundaries
- When looking for future milestones near year end, the app searches into the next year
- Earliest sunset, shortest day, etc., can span year boundaries correctly

---

## Known Bugs

### Bug 1: Date Input on Safari iOS
**Observed**: The date picker may not trigger change events consistently on Safari iOS when selecting dates.
**Expected**: Date changes should immediately update the displayed data.
**Impact**: Users may need to tap elsewhere to trigger the update.

### Bug 2: Geolocation Error Handling
**Observed**: When geolocation fails (user denies or timeout), no visible error message appears.
**Expected**: A user-friendly error message should indicate why geolocation failed.
**Impact**: Users may not understand why the location button doesn't work.

### Bug 3: Share Modal Snapshot Timing
**Observed**: The share preview is built when the modal opens, but if the user changes privacy setting, the location label updates but other data may be stale.
**Expected**: The entire share content should be consistent with what was displayed when the modal opened.
**Impact**: Minor - users see slightly inconsistent data in edge cases.

---

## Console Debugging

### Automatic Logging
- Every location/date change logs the full list of valid optimistic messages
- Format: "Optimistic messages for [Location] on [Date]:" followed by bullet points

### Debug API
- `window.SunshineOptimistDebug.getOptimisticMessages()`: Returns current state
- `window.SunshineOptimistDebug.printOptimisticMessages()`: Prints formatted table
