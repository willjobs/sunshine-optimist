# Git Hooks

This directory contains git hooks for the Sunshine Optimist project.

## Installation

To install the git hooks on your local machine:

```bash
chmod +x scripts/git-hooks/pre-commit
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

## pre-commit

Automatically updates the cache version before each commit to ensure browsers always fetch fresh CSS and JS files.

The version format is `v{commit-count}-{short-hash}` (e.g., `v79-0cba1f5`).

Updates are made to:

- `sw.js`: Updates `CACHE_VERSION` constant for service worker cache naming
- `index.html`: Updates `?v=...` query strings on CSS and JS references for HTTP cache busting

This dual approach ensures reliable cache invalidation across:

- Service worker caching (via versioned cache names)
- Browser HTTP caching (via query string versioning)
- CDN caching (via unique URLs per version)
