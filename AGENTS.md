# Sunshine Optimist - Agent Guide

## Project Overview

A static, single-page web app that turns sunrise/sunset calculations into optimistic daylight insights. Runs entirely in the browser with no backend—just ES modules, no build step.

## Key Files

- `index.html` — UI structure
- `styles.css` — all styling
- `scripts/app.js` — thin orchestrator wiring controllers together
- `scripts/controllers/` — domain logic (date, location, daylight, messages)
- `scripts/state/app-state.js` — centralized state with getter/setter functions
- `scripts/messages.js` — optimistic message templates
- `scripts/milestones.js` — milestone definitions

For detailed architecture, see [docs/architecture.md](docs/architecture.md).

## Code Style

### JavaScript
- ES modules with explicit imports/exports
- No build step or transpilation
- Prefer `const` over `let`; avoid `var`
- Use async/await for asynchronous code
- Controllers communicate via callbacks to avoid circular dependencies

### Formatting
- 2-space indentation
- Single quotes for strings
- No semicolons (project uses ASI)

### Naming
- `camelCase` for variables and functions
- `PascalCase` for classes (rare in this codebase)
- Descriptive names: `getYearlySunExtremes` not `getSunData`
- File names use kebab-case: `date-controller.js`


## Important Conventions

1. **Timezone handling**: Always evaluate dates in the selected location's timezone, not the user's local timezone.

2. **State access**: Use the getter/setter functions from `app-state.js`; don't access state directly.

3. **DOM selectors**: If changing element IDs/classes in `index.html`, update selectors in `app.js` and preserve ARIA attributes.

4. **Message data**: When adding messages, ensure `data_needs` keys exist in `messageData` (built in `daylight-controller.js`).

5. **Async calculations**: Heavy year-scanning uses async APIs that yield to the main thread. Don't block the UI.

## Development

Run locally:
```bash
python3 -m http.server
```

Debug messages via console or `window.SunshineOptimistDebug.printOptimisticMessages()`.

For contribution guidelines, see [docs/development.md](docs/development.md).
