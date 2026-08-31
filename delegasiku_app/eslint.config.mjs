import eslintPluginTypeScript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules', 'dist', 'build', '.svelte-kit', '.turbo', 'coverage'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTypeScript,
    },
    rules: {
      ...eslintPluginTypeScript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  eslintConfigPrettier,
];
