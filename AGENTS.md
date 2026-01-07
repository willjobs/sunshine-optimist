# Sunshine Optimist - Agent Guide

## Project Overview

A static, single-page web app that displays optimistic daylight insights. Runs entirely in the browser with no backend—just ES modules, no build step.

## Key Files

- `index.html` — UI structure
- `styles.css` — all styling
- `scripts/app.js` — main orchestrator wiring controllers together
- `scripts/controllers/` — domain logic (date, location, daylight, messages)
- `scripts/state/app-state.js` — centralized state with getter/setter functions
- `scripts/utils/` — utility modules (astronomy, date, location, dom)
- `scripts/messages.js` — optimistic message templates
- `scripts/milestones.js` — milestone definitions

For detailed architecture, see [docs/architecture.md](docs/architecture.md).

## Code Style

- ES modules with explicit imports/exports; no build step
- Prefer `const` over `let`; avoid `var`
- Use async/await for asynchronous code
- `camelCase` for variables/functions; kebab-case for file names
- Controllers communicate via callbacks to avoid circular dependencies

## Linting and Formatting

This project uses ESLint and Prettier. Configuration is in [eslint.config.js](eslint.config.js) and [.prettierrc.json](.prettierrc.json).

## Important Conventions

1. **Timezone handling**: Always evaluate dates in the selected location's timezone, not the user's local timezone
2. **State access**: Use getter/setter functions from `app-state.js`; don't access state directly
3. **DOM selectors**: If changing element IDs/classes in `index.html`, update selectors in `app.js` and preserve ARIA attributes
4. **Message data**: When adding messages, ensure `data_needs` keys exist in `messageData` (built in `daylight-controller.js`)
5. **Async calculations**: Heavy year-scanning uses async APIs that yield to the main thread. Don't block the UI

## Development

### Running Locally

```bash
python3 -m http.server
```

### Before Completing a Task

1. **Fix linting and formatting**:

   ```bash
   npm run lint:fix
   npm run format
   ```

2. **Run all tests**:
   ```bash
   npm run test:unit  # Vitest unit tests
   npm test           # Playwright E2E tests
   ```

### Debugging

Debug messages via console or `window.SunshineOptimistDebug.printOptimisticMessages()`.

For more details, see [docs/development.md](docs/development.md).
