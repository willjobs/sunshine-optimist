# Sunshine Optimist

A single-page web app that turns sunrise and sunset calculations into upbeat, seasonal insights about daylight for any city.

The goal is to combat seasonal sadness by highlighting positive aspects of daylight changes, especially during darker months when days are getting longer but still feel short.

## Features

- **City search** with typeahead, geolocation, local/worldwide toggles, and recent locations
- **Date picker** to explore daylight insights for any day in any timezone
- **Dynamic messaging** — seasonal, hemisphere-aware headlines that rotate automatically and with manual navigation
- **Stats panel** — sunset time and daylight duration with comparisons to yearly extremes
- **Milestone carousel** — upcoming events like half-hour sunsets, solstices, and daylight-gain milestones (with a special effect on milestone days :))
- **Share modal** — text and image modes with privacy toggle, copy-to-clipboard, and social sharing
- **Progressive Web App** — installable, works offline, with service worker caching

## Quick Start

No build step required. Just serve the files:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

For development with tests and linting, install dependencies:

```bash
npm install
npm run lint        # Check code quality
npm run test:unit   # Run unit tests
npm test            # Run end-to-end tests
```

## Project Structure

```
index.html              # UI structure
styles.css              # All styling
sw.js                   # Service worker for PWA/offline support
manifest.webmanifest    # PWA manifest
scripts/
├── app.js              # Main orchestrator
├── controllers/        # Business logic (date, location, daylight, messages)
├── state/              # Centralized state management
├── services/           # External APIs (geocoding, reverse geocode, storage)
├── ui/                 # UI components (messages, milestones, share, confetti, tooltips)
├── formatters/         # Display formatting utilities
├── utils/              # Core utilities (astronomy, date, location, DOM, web share)
├── messages.js         # Optimistic message templates
└── milestones.js       # Milestone definitions
```

## Technology

- Pure ES modules, no build step or bundler
- No frameworks or libraries (vanilla JavaScript)
- Modern Web APIs: Geolocation, Canvas, Clipboard, Web Share, Service Workers
- Tested with Playwright (E2E) and Vitest (unit tests)

## Data Sources

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — solar calculations (vendored)
- [Open-Meteo Geocoding API](https://open-meteo.com/) — city search
- [BigDataCloud](https://www.bigdatacloud.com/) — reverse geocoding

## Documentation

- [Architecture](docs/architecture.md) — module structure, data flows, and performance
- [Development Guide](docs/development.md) — contributing, debugging, and testing
- [Behavior Specification](docs/behavior.md) — complete app behavior and edge cases
