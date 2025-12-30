# Sunshine Optimist - Current Behavior

This document describes the app's current user-facing behavior, independent of
implementation details. It captures normal flows, edge cases, and known issues
that should be preserved or fixed during refactoring.

## Overview
- Single-page, browser-only experience with no backend. Network calls are made
  directly from the browser for city lookup and reverse geocoding.
- Core inputs are location and date; all calculations are shown for the chosen
  location's time zone, not the user's local time zone.
- Primary outputs are the optimistic headline/lede, sunset/daylight stats, a
  rolling upcoming milestone, and shareable text.

## Startup and default state
- On first load with no stored location, the app attempts to use browser
  geolocation if permission is already granted. If not, it falls back to a
  default location (Boston, MA, US).
- If a stored location is available, it is restored and immediately used.
- The date defaults to "today" in the selected location's time zone.
- The app does not auto-refresh at midnight; the date and calculations stay as
  they were until the user changes the date or location.

## Layout and major UI regions
- Header includes the brand mark/title plus two controls:
  - Location search with a geolocate button and clear button.
  - Date picker with a "Today" reset.
- Main card contains:
  - Headline and lede (optimistic messaging).
  - Two stats panels (Sunset and Daylight) with comparison deltas.
  - A "Coming up" milestone card with a next button.
- A call-to-action button opens a share modal dialog.

## Location search and suggestions
- Typing in the city input triggers a debounced lookup once at least two
  characters are present.
- The lookup uses the Open-Meteo geocoding API; results are displayed as a list
  beneath the input.
- A clear button becomes visible when the input has text. Clicking it clears the
  input, closes results, and returns to recent locations (if any).
- Suggestions are grouped into two sections:
  - Matches: results whose name starts with the query.
  - Nearby: other results returned by the API.
- Results are capped to 8 entries.
- The display format is "City, Region, Country" with U.S. state names
  abbreviated (e.g., "Portland, OR, United States").
- Keyboard interaction in the input:
  - Arrow Up/Down moves the active selection.
  - Home/End jumps to first/last.
  - Enter selects the active result.
  - Escape closes the results panel.
- Clicking a result selects it. Enter/Space on a focused result also selects it.
- Clicking or focusing outside the location control closes the results panel.

### Filtering and region tokens
- Users can append filter tokens after a comma (e.g., "Paris, FR" or
  "Portland, Oregon") to filter by region.
- If no comma is used, a trailing two-letter U.S. state abbreviation at the end
  of the query is treated as a filter (e.g., "Portland OR").
- A "dc" token expands to "District of Columbia".
- Tokens match against admin regions and country names/codes. If no matches are
  found, the app shows a hint and falls back to the full results list.

### Local vs worldwide results
- By default, results are biased toward "local" matches:
  - If the browser locale has a region code (e.g., US), local results are those
    in that country.
  - If geolocation is available, local results are still filtered by region
    but sorted by distance from the user's coordinates.
- A toggle button appears when both local and worldwide results are available:
  - "Show worldwide results" switches to the full list.
  - "Prefer local results" or "Prefer nearby results" switches back.
- If no local/nearby matches exist, a hint explains that worldwide results are
  being shown.

## Geolocation (Use my location)
- The geolocate button is disabled if the browser lacks geolocation support.
- Clicking the button requests the device location and temporarily disables the
  button with a "Locating..." tooltip.
- On success:
  - The app selects the current coordinates as the location.
  - It attempts to reverse-geocode to a readable place name.
  - If reverse geocoding fails, the label remains "Current Location" and the
    app retries when the current location is restored or reselected later.
- On failure or timeout:
  - The button re-enables.
  - No explicit error message is shown.

## Recent locations and persistence
- Up to five recent locations are stored and shown when the input is focused
  with fewer than two characters in the query.
- The most recently selected location is stored and restored on reload.
- The share privacy toggle state is stored and restored across sessions.

## Date selection and time zone handling
- The date picker uses the selected location's time zone. "Today" reflects the
  date in that time zone, not the user's device.
- Selecting a date updates all calculations and the optimistic message.
- Manual typing commits on blur or Enter; date picker changes commit after a
  short delay.
- The "Today" button resets to the live date and is disabled when already on
  live date.
- Clearing or entering an invalid date resets to live date.

## Daylight and sunset stats
- The app calculates sunrise, sunset, and daylight duration for the selected
  date and location.
- If sunrise or sunset is not available (e.g., polar day/night), the sunset and
  daylight values show a dash placeholder.
- The Sunset section displays:
  - The sunset time.
  - Difference from the earliest sunset of the year.
  - Difference from a recent reference point:
    - If month-over-month deltas are positive, compare to 1 month ago.
    - If month-over-month deltas are negative but week-over-week are positive,
      compare to 1 week ago.
    - If both are negative, this comparison row is hidden.
- The Daylight section mirrors the Sunset logic but compares against the
  shortest day of the year.
- Tooltip behavior for references:
  - Hovering or focusing the reference labels shows the exact time/date or
    duration for that reference.
  - On touch/pen devices, tapping toggles a tooltip; Escape closes it.

## Optimistic headline and lede
- The headline/lede are chosen from a seasonal catalog that is aware of
  hemisphere. Southern hemisphere months are shifted by six months to align
  with seasons.
- If no sunrise/sunset exists for the date, the copy is fixed to:
  - Headline: "Sunlight looks different here."
  - Lede: "No sunrise or sunset today."
- Otherwise, messages are filtered by required data and rules. If none match,
  a fallback message is shown:
  - Headline: "Enjoy the daylight today."
  - Lede: "Every bit of sunshine helps."
- When multiple messages apply, they rotate every ~15 seconds with a slide
  animation (disabled for reduced-motion settings).
- If a milestone falls on the selected date, its copy overrides the rotating
  optimistic message.

## Milestones
- The milestone card displays the next upcoming milestone with date and a
  "(X days/weeks away)" note.
- If multiple upcoming milestones exist, a next button cycles through them.
- Milestone types include:
  - Earliest sunset, shortest day, longest day.
  - Spring equinox and daylight savings time start.
  - First day with at least 12 hours of daylight.
  - Sunset thresholds (4:30pm, 5pm, 5:30pm, 6pm, 7pm, 8pm).
  - Daylight gain milestones since winter solstice (30, 60, 90, 120 minutes).
  - The next half-hour sunset threshold (e.g., "Next 5:30 PM Sunset"), unless
    the next half-hour would wrap past midnight.
- On a milestone date, confetti is shown once and the milestone copy replaces
  the normal optimistic message.

## Share modal
- The share button opens a modal dialog (native dialog when supported).
- The modal includes a privacy toggle labeled "Share as 'My Location'".
- The preview shows a multi-line text block that includes:
  - Location label (or "My Location" when privacy is enabled).
  - Short date label (e.g., "Jan. 14").
  - The current headline.
  - A daylight progress bar line (if applicable).
  - Daylight duration today.
  - Sunset delta vs earliest sunset.
  - The current upcoming milestone line.
  - "SunshineOptimist.com" branding.
- Progress line behavior:
  - When daylight is shortening, shows progress toward the shortest day unless
    the month is in summer (then it is omitted).
  - When daylight is lengthening, shows percent of maximum daylight.
- Copy to clipboard uses the Clipboard API when available; on success, the
  button briefly flashes "Copied!".
- Social buttons:
  - Instagram: copies text then opens instagram.com.
  - Facebook: opens a share dialog with the site URL and quote text.
  - X (Twitter): opens a tweet composer with the text.
  - Bluesky: opens a compose page with the text.
- Clicking outside the modal or pressing Escape closes it.

## Accessibility and ARIA behavior
- The location input uses combobox/listbox roles and live region status text.
- Suggestion options support keyboard selection and roving focus.
- Delta references are focusable when tooltips are available.
- The share modal uses accessible labels and close controls.

## Known issues / bugs
- None noted in this review.
