import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore build output, deps, and generated Smithery artifacts only
  // mcp-servers source files ARE linted — only .smithery generated dirs excluded
  globalIgnores([
    'dist',
    'node_modules',
    'mcp-servers/**/.smithery',
    'mcp-servers/**/node_modules',
  ]),

  // ── React / Browser (src/) ────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // Single authoritative ecmaVersion — parserOptions.ecmaVersion removed
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': 'off',
      // Disable strict React 19 hooks rules that require major refactors
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // Data files with legacy escape chars
      'no-useless-escape': 'warn',
    },
  },

  // ── Node.js / Vercel serverless (api/ root + subdirs, lib/) ──────────────
  // Fix #1: 'api/*.js' added so root-level Vercel functions get Node globals
  // Fix #5: scripts/**/*.js removed — no scripts/ directory exists
  {
    files: ['api/*.js', 'api/**/*.js', 'lib/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        // Vercel serverless edge runtime extras
        ...globals.browser,
      },
      sourceType: 'module',
    },
    rules: {
      // Consistent with src/ — warn not error, same ignore pattern style
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
    },
  },

  // ── MCP server source files (Node.js, no React rules) ────────────────────
  {
    files: ['mcp-servers/**/*.js', 'mcp-servers/**/*.ts'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
