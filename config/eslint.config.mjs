// config/eslint.config.mjs
import globals from 'globals';
import js from '@eslint/js';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        google: 'readonly',
        dragula: 'readonly'
      },
    },
    files: ['**/*.js'],
  },
  js.configs.recommended,
  {
    rules: {
      'indent': ['error', 4],
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-var': 'error'
    }
  }
];
