// @ts-check
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from '../../eslint.config.mjs';

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...baseConfig,
  // NestJS-specific: enable stricter type-checked rules
  ...tseslint.configs.recommendedTypeCheckedOnly,
  {
    languageOptions: {
      globals: {
        ...globals.jest,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
);
