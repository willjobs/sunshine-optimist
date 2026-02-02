# Development Guide

## Getting Started

This is a static site with ES modules and no build step. To run locally:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

### Install Git Hooks

The project uses a pre-commit hook to automatically update the service worker cache version:

```bash
chmod +x scripts/git-hooks/pre-commit
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

## Code Quality

### Linting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix where possible
```

### Formatting

```bash
npm run format:check  # Check formatting
npm run format        # Auto-format all files
```

## Testing

### Unit Tests (Vitest)

```bash
npm run test:unit
```

### End-to-End Tests (Playwright)

```bash
npm test              # Headless
npm run test:headed   # Visible browser
npm run test:ui       # Interactive UI mode
```

The Playwright config automatically starts a local server on port 9247.

## Debugging

### Optimistic Messages

Console logs the full list of optimistic messages on page load and when location/date changes.

Debug helpers on `window.SunshineOptimistDebug`:

- `printOptimisticMessages()` — reprints the current list
- `getOptimisticMessages()` — returns the computed data and reason (`ok`, `fallback`, or `polar`)

## Adding Optimistic Messages

Messages live in `scripts/messages.js`. Each message has:

```javascript
{
  headline: "Today's sunset is {## minutes} later than yesterday.",
  lede: "Enjoy the extra evening light!",
  months: [1, 2, 3],                           // When this message can appear (1 = Jan)
  data_needs: ["sunset_today", "sunset_yesterday"],  // Required data keys
  group: "sunset_comparison",                  // Optional grouping for de-duplication
  additional_requirements: "sunset_today > sunset_yesterday",  // Optional condition
  getValue: ({ sunset_today, sunset_yesterday }) =>   // Returns placeholder value
    sunset_today - sunset_yesterday,
}
```

### Placeholders

- `{## minutes}` — "X minutes" or "X hours Y minutes"
- `{## days}` — "X days" or "X day"
- `{## weeks}` — "X weeks" or "X week"
- `{##%}` — "X%" (rounded)

The `getValue` function should return a positive number, or `null` to hide the message.

### Grouping and Capping

Messages can include an optional `group` string. If multiple valid messages share the same non-null `group`, only one is kept: the message with the highest `getValue()` result, except groups `sunset_countdown` and `milestone_countdown` which keep the lowest value. Messages with `group: null` are always retained. After grouping, the list is capped.

### Adding New Data Keys

1. Find `buildMessageData()` in `scripts/controllers/daylight-controller.js`
2. Add your key to the returned object
3. Use existing calculations from `astronomy-utils.js` or add new ones

## Adding Milestones

### Static Milestones (`scripts/milestones.js`)

**Sunset threshold milestones**:

```javascript
{
  id: "sunset-after-6",
  title: "First sunset after 6pm",
  minutes: 18 * 60,  // Threshold in minutes from midnight
  todayHeadline: "First 6pm sunset of the year!",
  todayLede: "Longer evenings ahead.",
}
```

**Daylight gain milestones**:

```javascript
{
  id: "gain-60",
  title: "Gained 1 hour of daylight since the winter solstice",
  minutes: 60,  // Threshold in minutes
  todayHeadline: "You've gained 1 hour of daylight since the winter solstice.",
  todayLede: "Evenings feel brighter already.",
}
```

### Computed Milestones

Dynamic milestones are built in `buildUpcomingMilestones()` in `daylight-controller.js`. To add a new computed milestone, update that function.

## Modifying the DOM

If you change `index.html` ids/classes:

- Update the DOM selectors in `app.js`
- Keep ARIA attributes intact for the location combobox

## Manual Testing Checklist

- City search (local and worldwide toggle)
- Geolocation
- Date picker and Today reset
- Milestone rotation
- Share modal (preview, privacy toggle, copy, social links)
- Different hemispheres and seasons
- Polar day/night edge cases
