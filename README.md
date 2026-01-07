# Sunshine Optimist

A single-page web app that turns sunrise and sunset calculations into upbeat, seasonal insights about daylight for any city.

The goal is to combat the dread or sadness people feel as days get shorter, or during winter months when days are getting longer but still feel short.

## Features

- **City search** with autocomplete, geolocation, and recent locations
- **Date picker** to explore any day's daylight data
- **Dynamic messaging** that rotates seasonal, hemisphere-aware headlines
- **Stats panel** showing sunset time and daylight duration with comparisons
- **Milestone carousel** tracking upcoming events like solstices and sunset thresholds
- **Share modal** with text preview, privacy toggle, and Instagram story image generation

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
├── utils/              # Utilities (astronomy, date, location, dom)
├── messages.js         # Optimistic message catalog
└── milestones.js       # Milestone definitions
sw.js                   # Service worker for offline support
manifest.webmanifest    # PWA manifest
```

## Data Sources

- [Open-Meteo Geocoding API](https://open-meteo.com/) — city search
- [BigDataCloud](https://www.bigdatacloud.com/) — reverse geocoding for current location
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — solar calculations

## Documentation

- [Architecture](docs/architecture.md) — module structure and data flows
- [Behavior](docs/behavior.md) — user interactions and edge cases
- [Development Guide](docs/development.md) — contributing, debugging, and testing
