# Sunshine Optimist - Refactor Plan

## Goals
- Improve maintainability by separating concerns (date/time math, astronomy
  calculations, location search, share logic, UI updates).
- Improve extensibility by centralizing state and reducing implicit global
  coupling.
- Improve performance by caching expensive astronomy calculations and reusing
  formatters.
- Preserve all user-facing behavior described in CURRENT_BEHAVIOR.md.

## Non-goals
- No visual redesign or copy changes beyond behavior bug fixes.
- No backend changes; remain a static, browser-only app.

## Planned work

### 1) Introduce shared utilities and module boundaries
Rationale: `scripts/app.js` currently mixes UI wiring, state, formatting, and
astronomy logic. Breaking this up makes it easier to reason about and extend.

Planned changes:
- Create a `scripts/date-utils.js` module for date parts math, time zone
  conversions, and date formatting (e.g., `getZonedParts`, `addDaysToDateParts`,
  `formatLongDateFromParts`).
- Create a `scripts/formatters.js` module for display formatting (durations,
  deltas, share strings, milestone labels).
- Create a `scripts/astronomy-utils.js` module for sun event calculation and
  seasonal helpers, leaving only orchestration in `app.js`.
- Keep `scripts/messages.js` and `scripts/milestones.js` as data catalogs but
  remove unused exports.

### 2) Centralize app state and DOM references
Rationale: top-level mutable variables are scattered across `app.js`, making it
hard to trace updates.

Planned changes:
- Create a single `state` object (or small set of state objects) that holds:
  active location, date selection, recent locations, search results, share
  state, and milestone state.
- Group DOM lookups into a `dom` object so elements are accessed consistently
  (and can be validated once).
- Rename ambiguous variables (`cityInput` -> `locationInput`, etc.) to reduce
  cognitive load.

### 3) Cache expensive calculations
Rationale: `getYearlySunExtremes` and repeated `getSunEvents` calls can be
expensive on every update.

Planned changes:
- Add a simple in-memory cache keyed by location+timezone+date for sunrise,
  sunset, and daylight duration.
- Cache yearly extremes and seasonal dates per location+timezone+year.
- Ensure caches are invalidated when location or timezone changes.

### 4) Decompose daylight update pipeline
Rationale: `updateDaylightForLocation` is very long and mixes computation with
UI rendering.

Planned changes:
- Split into pure calculation steps that return a structured snapshot:
  - `buildSunSnapshot` (sunset/sunrise/daylight values)
  - `buildComparisonSnapshot` (deltas and reference tooltips)
  - `buildMessageData` (inputs for optimistic messaging)
  - `buildMilestoneList` (upcoming milestones and today's milestone)
  - `buildShareSnapshot` (data needed for sharing)
- Keep UI rendering in small, focused functions (`renderStats`,
  `renderOptimisticCopy`, `renderMilestoneCard`).

### 5) Clean up dead code and unused branches
Rationale: removing unused logic reduces noise and risk.

Planned changes:
- Remove the unused `selectOptimisticMessage` export.
- Remove unused state fields and unused action handlers (e.g., `lastQuery`, the
  `geolocate` results action that is never created).
- Normalize fetch error handling into a shared helper to reduce duplication.

### 6) Document bug fixes and update AGENTS.md
Rationale: ensure behavior docs stay aligned after refactor and fixes.

Planned changes:
- Fix the documented bugs (12-hour milestone naming/logic, reverse geocode retry,
  midnight wrap in next half-hour sunset milestone) while preserving all other
  behavior.
- Update CURRENT_BEHAVIOR.md and AGENTS.md to reflect the refactor and fixes.

## Checkpoints and commits
- Commit 1: CURRENT_BEHAVIOR.md and REFACTOR_PLAN.md.
- Commit 2+: Refactor in logical slices (utilities/modules, caching, daylight
  pipeline, cleanup).
- Final commit: behavior doc + AGENTS.md updates after refactor.
