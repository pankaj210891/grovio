// @ts-check
/**
 * @grovio/config — ESLint 9 flat-config factory
 *
 * Usage in consuming apps/packages:
 *
 *   import { createEslintConfig } from '@grovio/config/eslint-preset';
 *   export default createEslintConfig({ react: true });
 *
 * Or with overrides:
 *
 *   export default createEslintConfig({ react: true }, [
 *     { files: ['src/legacy/**'], rules: { '@typescript-eslint/no-explicit-any': 'warn' } },
 *   ]);
 */

'use strict';

const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const eslintConfigPrettier = require('eslint-config-prettier');

/**
 * Create a base ESLint 9 flat-config array for Grovio workspace packages.
 *
 * @param {{ react?: boolean; viteRefresh?: boolean }} [options]
 * @param {import('eslint').Linter.FlatConfig[]} [overrides]
 * @returns {import('eslint').Linter.FlatConfig[]}
 */
function createEslintConfig(options = {}, overrides = []) {
  const { react = false, viteRefresh = false } = options;

  /** @type {import('eslint').Linter.FlatConfig[]} */
  const config = [
    // ── Global ignores ──────────────────────────────────────────────────────
    {
      ignores: ['node_modules/**', 'dist/**', 'build/**', '.turbo/**', 'coverage/**'],
    },

    // ── TypeScript source files ──────────────────────────────────────────────
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: typescriptParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      },
      plugins: {
        '@typescript-eslint': typescriptEslint,
      },
      rules: {
        // TypeScript strict rules
        '@typescript-eslint/no-explicit-any': 'error',
        // no-unsafe-* rules require full type resolution (projectService) which
        // is unreliable in monorepo CI before workspace packages are compiled.
        // Enforced via typecheck (tsc --noEmit) instead.
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/consistent-type-exports': 'error',
        // Type-aware async rules — also require projectService; skipped here.
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-misused-promises': 'off',

        // Import ordering (requires eslint-plugin-import or use tsc for ordering)
        // Basic no-duplicate-imports at the native ESLint level
        'no-duplicate-imports': 'error',

        // General code quality
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'prefer-const': 'error',
        'no-var': 'error',
      },
    },
  ];

  // ── React-specific rules ─────────────────────────────────────────────────
  if (react) {
    try {
      const reactHooksPlugin = require('eslint-plugin-react-hooks');

      config.push({
        files: ['**/*.tsx', '**/*.jsx'],
        plugins: {
          'react-hooks': reactHooksPlugin,
        },
        rules: {
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'warn',
        },
      });
    } catch {
      // eslint-plugin-react-hooks not installed in this package — skip
    }
  }

  // ── Vite React Refresh rules (dev-only HMR correctness) ─────────────────
  if (react && viteRefresh) {
    try {
      const reactRefreshPlugin = require('eslint-plugin-react-refresh');

      config.push({
        files: ['**/*.tsx'],
        plugins: {
          'react-refresh': reactRefreshPlugin,
        },
        rules: {
          'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        },
      });
    } catch {
      // eslint-plugin-react-refresh not installed — skip
    }
  }

  // ── Prettier integration — must be last to disable conflicting rules ──────
  config.push(eslintConfigPrettier);

  // ── Consumer overrides ────────────────────────────────────────────────────
  config.push(...overrides);

  return config;
}

module.exports = { createEslintConfig };
