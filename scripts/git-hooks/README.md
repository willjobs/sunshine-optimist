# Git Hooks

This directory contains git hooks for the Sunshine Optimist project.

## Installation

To install the git hooks on your local machine:

```bash
chmod +x scripts/git-hooks/pre-commit
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

## pre-commit

Automatically updates the service worker cache version before each commit to ensure browsers always fetch fresh CSS and JS files.

The version format is `v{commit-count}-{short-hash}` (e.g., `v79-0cba1f5`).
