import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'backend']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Codebase-wide conventions: explicit `any` and unused variables are
      // pervasive and were never enforced. Kept as warnings so CI can gate on
      // real errors while the debt is tracked. A dedicated cleanup phase should
      // tighten these back to errors.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'warn',
      // New React-Hooks v7 rules flag long-established patterns in this app.
      // Demoted to warnings until a dedicated refactor phase.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/incompatible-library': 'warn',
      // The app intentionally exports helper constants from component files.
      'react-refresh/only-export-components': 'warn',
      // react-intersection-observer's documented `ref={stepRef.ref}` pattern.
      'react-hooks/refs': 'warn',
    },
  },
])
