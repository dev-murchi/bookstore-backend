import { defineConfig, globalIgnores } from 'eslint/config';

import tsParser from '@typescript-eslint/parser';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';

import globalsPkg from 'globals';
const { node, jest } = globalsPkg;

import eslintJsPkg from '@eslint/js';
const { configs } = eslintJsPkg;

import { FlatCompat } from '@eslint/eslintrc';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: configs.recommended,
  allConfig: configs.all,
});
export default defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...node,
        ...jest,
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
    },

    extends: compat.extends(
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ),

    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores(['**/.eslintrc.js']),
]);
