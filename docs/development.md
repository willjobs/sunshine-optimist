# Development Guide

## Getting Started

This is a static site with ES modules and no build step. To run locally:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## Debugging

### Optimistic Messages

The console logs the full list of optimistic messages on page load, when a new location is selected, and when the date changes, in the format: `Optimistic messages for {LOCATION} on {DATE}:`.

Debug helpers are available on `window.SunshineOptimistDebug`:

- `printOptimisticMessages()` — reprints the current list
- `getOptimisticMessages()` — returns the last computed data, valid options, displayed options, and the reason (`ok`, `fallback`, or `polar`)

## Adding Optimistic Messages

Messages live in `scripts/messages.js` in the `OPTIMISTIC_MESSAGES` array. Each message has this structure:

```javascript
{
  headline: "Today's sunset is {## minutes} later than yesterday.",
  lede: "Enjoy the extra evening light!",
  months: [1, 2, 3],                           // When this message can appear (1 = Jan)
  data_needs: ["sunset_today", "sunset_yesterday"],  // Required data keys
  additional_requirements: "sunset_today > sunset_yesterday",  // Optional condition
  getValue: ({ sunset_today, sunset_yesterday }) =>   // Returns the placeholder value
    sunset_today - sunset_yesterday,
}
```

### Message fields

| Field                     | Required | Description                                                                             |
| ------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `headline`                | Yes      | Main message text. Can include `{## unit}` placeholders.                                |
| `lede`                    | No       | Secondary text shown below the headline.                                                |
| `months`                  | Yes      | Array of months (1-12) when the message is valid. Adjusted for hemisphere.              |
| `data_needs`              | Yes      | Array of keys that must exist in `messageData`.                                         |
| `additional_requirements` | No       | Comparison expression like `"value_a > value_b"`. Supports `>`, `<`, `>=`, `<=`, `==`.  |
| `getValue`                | No       | Function returning a number for placeholders. Required if headline/lede has `{## ...}`. |

### Placeholders

Use `{## unit}` in headlines or ledes:

- `{## minutes}` — formats as "X minutes" or "X hours Y minutes"
- `{## days}` — formats as "X days" or "X day"
- `{## weeks}` — formats as "X weeks" or "X week"
- `{##%}` — formats as "X%" (rounded)

The `getValue` function receives `messageData` and should return a positive number, or `null` to hide the message.

### Adding new data keys

If your message needs data that doesn't exist yet:

1. Find `buildMessageData()` in `scripts/controllers/daylight-controller.js`
2. Add your new key to the returned object
3. Use existing astronomy calculations from `astronomy-utils.js` or add new ones

### Example: Adding a new message

```javascript
{
  headline: "Sunrise is {## minutes} earlier than last week.",
  lede: "More morning light!",
  months: [3, 4, 5],
  data_needs: ["sunrise_today", "sunrise_one_week_ago"],
  additional_requirements: "sunrise_today < sunrise_one_week_ago",
  getValue: ({ sunrise_today, sunrise_one_week_ago }) =>
    sunrise_one_week_ago - sunrise_today,
}
```

## Adding Milestones

Milestones are defined in two places:

### Static milestones (`scripts/milestones.js`)

Two arrays of predefined milestones:

**Sunset threshold milestones** — trigger when sunset first crosses a time boundary:

```javascript
{
  id: "sunset-after-6",
  title: "First sunset after 6pm",           // Shown in milestone carousel
  minutes: 18 * 60,                           // Threshold in minutes from midnight
  todayHeadline: "First 6pm sunset of the year!",  // Shown when it's today
  todayLede: "Longer evenings ahead.",
}
```

**Daylight gain milestones** — trigger when daylight gained since winter solstice crosses a threshold:

```javascript
{
  id: "gain-60",
  title: "Gained 1 hour of daylight since the winter solstice",
  minutes: 60,                                // Threshold in minutes
  todayHeadline: "You've gained 1 hour of daylight since the winter solstice.",
  todayLede: "Evenings feel brighter already.",
}
```

### Computed milestones (`scripts/controllers/daylight-controller.js`)

Dynamic milestones are built in `buildUpcomingMilestones()`:

- Earliest sunset of the year
- Shortest/longest day of the year
- Spring/fall equinox
- Summer/winter solstice
- DST start (spring forward)
- Next half-hour sunset (e.g., "5:30pm sunset")

To add a new computed milestone, update `buildUpcomingMilestones()` in `daylight-controller.js`.

### Milestone structure

All milestones need:

- `id` — unique identifier
- `title` — text for the carousel
- `date` — JavaScript Date object (computed milestones set this dynamically)
- `todayHeadline` / `todayLede` — optional override when the milestone is today

## Modifying the DOM

If you change `index.html` ids/classes:

- Update the DOM selectors in `app.js`
- Keep the ARIA attributes for the location combobox intact

## Testing

Manual checks usually cover the main flows:

- City search (local and worldwide toggle)
- Geolocation bias
- Date picker and Today reset
- Milestone rotation
- Share modal (preview, privacy toggle, copy, social links)
- Different hemispheres and seasons
- Polar day/night edge cases
