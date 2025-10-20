// ESLint Flat Config (ESLint 9)
// Migration from .eslintrc.cjs (2025-10-20)
// Preserves React-specific plugins and browser environment

import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  // Global ignores (replaces .eslintignore + ignorePatterns)
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',
      '**/useCommentMutations.test.ts', // From .eslintignore
    ],
  },

  // Base config for all TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // ESLint recommended
      ...eslint.configs.recommended.rules,

      // TypeScript recommended
      ...tseslint.configs.recommended.rules,

      // React Hooks recommended
      ...reactHooks.configs.recommended.rules,

      // Custom rules (preserve from .eslintrc.cjs)
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },

  // Test file overrides (preserve from .eslintrc.cjs)
  {
    files: ['**/test/setup.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
