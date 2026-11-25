import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.server/**',
      'node_modules/**',
      'coverage/**',
      'docs/**',
      '*.cjs'
    ]
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true }
      ]
    }
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.test-d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' }
      ]
    }
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked
  }
)
