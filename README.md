# Sunshine Optimist

This is a static site that provides optimistic takes on the amount of daylight and time of sunset at any time of year, for any place on Earth. All daylight calculations happen in the browser (thanks to [Astronomy Engine](https://github.com/cosinekitty/astronomy)). The goal is to combat the dread or sadness many people feel as the days get shorter and throughout the winter months. A lot of thought was put into how to provide an optimistic framing _throughout_ the year, not just the winter.

## Background

Like many others, I dreaded the short winter days. Not only that, it always felt like we lost daylight too quickly in the fall, and gained it back way too slowly in the spring. Altogether, that was like half a year of being unhappy with the daylight situation! To deal with these feelings, I became obsessed with staring at tables of sunset times and day lengths to try to find little optimistic "milestones": the first day with a sunset after 5pm, the first day with over an hour more sunlight than the winter solstice, etc

I did that for myself for a while, mentioning it in conversation whenever the topic of short days came up. Eventually, I thought it might be fun to share these insights in occasional posts on social media. I was surprised when **lots** of people sent me messages saying how it helped them survive the winter.

After doing that for a couple years, it occurred to me that I could help a lot more people by making a site where people could get these optimistic messages whenever they need them and no matter where they live. And here we are :)

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
