import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist/**', '.angular/**']},
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // These existing tests exercise private component state and partial DOM/API fakes.
    // Keep the production no-explicit-any rule and all other recommended rules intact.
    files: ['tests/app.test.ts', 'tests/model.test.ts', 'tests/scene.test.ts', 'tests/sprites.test.ts'],
    rules: {'@typescript-eslint/no-explicit-any': 'off'},
  },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
  },
  {
    files: ['tests/browser-regression.mjs'],
    // Node harness globals; document is evaluated only inside Playwright page callbacks.
    languageOptions: {globals: {URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', console: 'readonly', document: 'readonly'}},
  },
);
