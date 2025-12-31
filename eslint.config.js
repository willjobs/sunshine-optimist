import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "astronomy-engine/**", // Third-party library
      "*.min.js",
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Main configuration for all JS files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        Astronomy: "readonly", // Third-party astronomy library
      },
    },
    plugins: {
      import: importPlugin,
      jsdoc: jsdocPlugin,
    },
    rules: {
      // ESLint recommended overrides
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "table"] }],

      // Import plugin rules
      "import/no-unresolved": "off", // Browser doesn't need resolution checking
      "import/named": "error",
      "import/no-duplicates": "error",
      "import/extensions": ["error", "always", { ignorePackages: true }],

      // Best practices
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "error",
      "no-throw-literal": "error",
      "prefer-template": "warn",
      "object-shorthand": "warn",

      // Code quality
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // JSDoc rules (helpful but not required)
      "jsdoc/check-alignment": "warn",
      "jsdoc/check-indentation": "warn",
      "jsdoc/check-syntax": "warn",
      "jsdoc/check-tag-names": "warn",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
    },
  },

  // Test files configuration
  {
    files: ["tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Playwright config file
  {
    files: ["playwright.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
];
