# Sunshine Optimist

A single-page web app that turns sunrise and sunset calculations into upbeat, seasonal insights about daylight for any city.

The goal is to battle the dread or sadness people feel as the days get shorter, or during those winter months when days are getting longer but still feel so short.

## Features

- **City search** with typeahead, geolocation bias, local/worldwide toggles, and recent locations
- **Date picker** to explore daylight insights for any day
- **Dynamic messaging** — seasonal, hemisphere-aware headlines that rotate when multiple apply
- **Stats panel** — today's sunset and daylight duration with comparisons to extremes
- **Milestone carousel** — upcoming events like half-hour sunsets, solstices, and daylight-gain milestones (with confetti!)
- **Share modal** — preview, privacy toggle, copy-to-clipboard, and social links

## Quick Start

No build step required. Just serve the files:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## Project Layout

```
index.html              # UI structure
styles.css              # All styling
scripts/
├── app.js              # Main orchestrator
├── controllers/        # Domain logic (date, location, daylight, messages)
├── state/              # Centralized state management
├── services/           # API calls (geocoding, reverse geocode, storage)
├── ui/                 # UI components (messages, milestones, share, tooltips)
├── formatters/         # Display formatting
├── messages.js         # Optimistic message catalog
├── milestones.js       # Milestone definitions
└── *-utils.js          # Utilities (astronomy, date, location, dom)
```

## Data Sources

- [Open-Meteo Geocoding API](https://open-meteo.com/) — city search
- [BigDataCloud](https://www.bigdatacloud.com/) — reverse geocoding for current location
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — solar calculations

## Documentation

- [Architecture](docs/architecture.md) — detailed module structure and data flows
- [Development Guide](docs/development.md) — contributing, debugging, and testing
