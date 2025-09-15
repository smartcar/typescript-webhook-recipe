// eslint.config.mjs
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended, // Enables recommended core ESLint rules
  ...tseslint.configs.recommended, // Enables recommended TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'], // Apply these rules only to .ts and .tsx files
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'], // Specify your tsconfig.json for type-aware linting
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Custom rules or overrides can be added here
      '@typescript-eslint/explicit-function-return-type': 'off', // Example: Disable explicit return types
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Example: Warn on unused vars, ignore args starting with underscore
    },
  },
  {
    files: ['jest.config.js', '.mocharc.js'],
    languageOptions: {
      globals: { module: true, require: true },
      sourceType: 'script',
    },
    rules: {
      // Optionally, you can turn off specific rules for this file
      'no-undef': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'cdk.out/', 'test/', 'scripts/', 'src/generated'], // Files and directories to ignore from linting
  }
);