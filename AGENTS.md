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

### Linting and Formatting

This project uses **ESLint** for linting and **Prettier** for code formatting.

- **Always run the linter and formatter before running tests**:
  ```bash
  npm run lint:fix
  npm run format
  ```
- The linter enforces strict equality (`===`/`!==`), no unused variables, and other code quality rules
- Prettier enforces consistent formatting (2-space indentation, single quotes, no semicolons)
- See [eslint.config.js](eslint.config.js) and [.prettierrc.json](.prettierrc.json) for configuration details

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

### Running Locally

The app is a static site with no build step. Open `index.html` directly in a browser, or use a local server:

```bash
python3 -m http.server
```

### Testing

The project uses **Playwright** for end-to-end tests and **Vitest** for unit tests.

#### Running Tests

After completing a task, **always run all tests** to verify nothing broke. Follow this workflow:

1. **Fix linting and formatting issues first**:
   ```bash
   npm run lint:fix
   npm run format
   ```

2. **Run both unit tests AND end-to-end tests**:
   ```bash
   # Run Vitest unit tests
   npm run test:unit

   # Run Playwright E2E tests (headless)
   npm test
   ```

3. **Additional Playwright options** (if needed):
   ```bash
   # Run Playwright with visible browser
   npm run test:headed

   # Run Playwright in interactive UI mode
   npm run test:ui
   ```

**Important**:
- The Playwright config automatically starts a Python http server on port 9247 before running tests. You don't need to start it manually.
- **Always run both unit tests (`npm run test:unit`) and E2E tests (`npm test`) before considering a task complete**.

#### Playwright Test Best Practices

1. **Always run tests after completing a task** to catch regressions
2. **Take screenshots** to debug test failures:
   ```bash
   npx playwright test --screenshot=on
   ```
3. **Check the console** for warnings or errors during tests. Address any console errors before considering a task complete.
4. **Use the HTML report** to view detailed results:
   ```bash
   npx playwright show-report
   ```

#### Writing Tests

- **Playwright** ([tests/](tests/)): Test user flows, UI interactions, and integration with external services
- **Vitest** (files ending in `.test.js`): Test utility functions, formatters, and isolated logic

See [tests/example.spec.js](tests/example.spec.js) for Playwright examples.

### Debugging

Debug messages via console or `window.SunshineOptimistDebug.printOptimisticMessages()`.

For contribution guidelines, see [docs/development.md](docs/development.md).
