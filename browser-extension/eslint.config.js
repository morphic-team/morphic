const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const json = require('@eslint/json').default;
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'package-lock.json']
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js', '**/*.ts']
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // CommonJS for build scripts
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      ...prettierConfig.rules,

      // Code quality
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-debugger': 'error',
      'no-alert': 'error',

      // Best practices (formatting rules removed - handled by Prettier)
      curly: 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'script', // Browser scripts
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        MouseEvent: 'readonly',
        HTMLDivElement: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLAnchorElement: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...prettierConfig.rules,

      // Code quality
      'no-unused-vars': 'off', // Use TypeScript's version instead
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': 'off', // We handle this via our logger
      'no-debugger': 'error',
      'no-alert': 'error',

      // Best practices (formatting rules removed - handled by Prettier)
      curly: 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    files: ['src/shared/logger.ts', 'src/shared/morphic-scraper.ts'],
    rules: {
      'no-redeclare': 'off', // logger/Scraper is defined in these files
      '@typescript-eslint/no-unused-vars': 'off' // These are exported globals
    }
  },
  {
    files: ['src/shared/morphic-scraper.ts', 'src/chrome/background.ts', 'src/chrome/content.ts'],
    languageOptions: {
      globals: {
        logger: 'readonly',
        Scraper: 'readonly'
      }
    }
  },

  // JSON linting
  {
    plugins: {
      json
    }
  },
  {
    files: ['package.json'],
    language: 'json/json',
    rules: {
      'json/no-duplicate-keys': 'error',
      'json/no-empty-keys': 'error',
      'json/no-unsafe-values': 'error',
      'json/sort-keys': ['error', 'asc', { natural: true }]
    }
  },
  {
    files: ['src/chrome/manifest.json'],
    language: 'json/json',
    rules: {
      'json/no-duplicate-keys': 'error',
      'json/no-empty-keys': 'error',
      'json/no-unsafe-values': 'error'
      // Don't sort manifest keys - logical order is better
    }
  },
  {
    files: ['tsconfig.json'],
    language: 'json/jsonc', // TypeScript config allows comments
    rules: {
      'json/no-duplicate-keys': 'error',
      'json/no-empty-keys': 'error',
      'json/no-unsafe-values': 'error'
      // Don't sort tsconfig keys - order matters
    }
  }
];
