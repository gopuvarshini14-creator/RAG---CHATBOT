import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'react/prop-types': 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: true,
        document: true,
        navigator: true,
        console: true,
        setTimeout: true,
        clearInterval: true,
        setInterval: true,
        clearTimeout: true,
        fetch: true,
        URL: true,
        FormData: true,
        localStorage: true,
        AbortController: true,
        FileReader: true,
      },
    },
  },
]
