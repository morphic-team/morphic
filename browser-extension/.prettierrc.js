module.exports = {
  // Prettier automatically reads .editorconfig for these settings:
  // - tabWidth (from indent_size)
  // - useTabs (from indent_style)
  // - endOfLine (from end_of_line)

  // Additional Prettier-specific settings
  singleQuote: true,
  trailingComma: 'none',
  bracketSpacing: true,
  arrowParens: 'avoid',
  printWidth: 100,

  // Override for JSON files to match our ESLint rules
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    }
  ]
};

