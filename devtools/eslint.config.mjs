// @ts-check
import eslint from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared base ESLint config for all packages.
 * Import in package-level configs:
 *   import { baseConfig } from '../../eslint.config.mjs';
 */
export const baseConfig = tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      // Import sorting (auto-fixable with --fix)
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Unused imports (auto-fixable with --fix)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Prettier
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);

/** Root-level ESLint config (for running `eslint .` from workspace root) */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      'common/debate-web/**',
      'tinybots/local/**',
      'ecosystem.config.cjs',
    ],
  },
  ...baseConfig,
  // Allow require() in JS/CJS files (CommonJS, oclif bin stubs, etc.)
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Suppress no-explicit-any for nestjs-debate (Prisma type casting)
  {
    files: ['common/nestjs-debate/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
