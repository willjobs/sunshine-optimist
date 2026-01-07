# Sunshine Optimist - Agent Guide

## Project Overview

A static, single-page web app that turns sunrise/sunset calculations into optimistic daylight insights. Runs entirely in the browser with no backend—just ES modules, no build step.

## Key Files

- `index.html` — UI structure
- `styles.css` — all styling
- `scripts/app.js` — thin orchestrator wiring controllers together
- `scripts/controllers/` — domain logic (date, location, daylight, messages)
- `scripts/state/app-state.js` — centralized state with getter/setter functions
- `scripts/utils/` — utility modules (astronomy, date, location, dom)
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

### Naming

- `camelCase` for variables and functions
- `PascalCase` for classes (rare in this codebase)
- Descriptive names: `getYearlySunExtremes` not `getSunData`
- File names use kebab-case: `date-controller.js`

### Linting and Formatting

This project uses **ESLint** for linting and **Prettier** for code formatting.

- Linter enforces strict equality (`===`/`!==`), no unused variables, and other code quality rules
- Prettier enforces consistent formatting (2-space indentation, single quotes, no semicolons)
- See [eslint.config.js](eslint.config.js) and [.prettierrc.json](.prettierrc.json) for configuration

## Important Conventions

1. **Timezone handling**: Always evaluate dates in the selected location's timezone, not the user's local timezone
2. **State access**: Use the getter/setter functions from `app-state.js`; don't access state directly
3. **DOM selectors**: If changing element IDs/classes in `index.html`, update selectors in `app.js` and preserve ARIA attributes
4. **Message data**: When adding messages, ensure `data_needs` keys exist in `messageData` (built in `daylight-controller.js`)
5. **Async calculations**: Heavy year-scanning uses async APIs that yield to the main thread. Don't block the UI

## Development

### Running Locally

The app is a static site with no build step. Open `index.html` directly in a browser, or use a local server:

```bash
python3 -m http.server
```

### Testing

The project uses **Playwright** for end-to-end tests and **Vitest** for unit tests.

**Before considering a task complete, you must:**

1. **Fix linting and formatting**:

   ```bash
   npm run lint:fix
   npm run format
   ```

2. **Run all tests** (both unit and E2E):
   ```bash
   npm run test:unit  # Vitest unit tests
   npm test           # Playwright E2E tests (headless)
   ```

**Additional test commands** (as needed):

```bash
npm run test:headed              # Run Playwright with visible browser
npm run test:ui                  # Run Playwright in interactive UI mode
npx playwright test --screenshot=on  # Debug with screenshots
npx playwright show-report       # View detailed HTML report
```

**Notes**:

- The Playwright config automatically starts a Python http server on port 9247 before running tests
- Address any console errors or warnings before considering a task complete
- **Playwright** ([tests/](tests/)): Test user flows, UI interactions, and integration with external services
- **Vitest** (files ending in `.test.js`): Test utility functions, formatters, and isolated logic

### Debugging

Debug messages via console or `window.SunshineOptimistDebug.printOptimisticMessages()`.

For contribution guidelines, see [docs/development.md](docs/development.md).
