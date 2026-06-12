/** @type {import('tailwindcss').Config} */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: withAlpha('--accent'),
          light: withAlpha('--accent-light'),
          dark: withAlpha('--accent-dark'),
        },
        racing: {
          50: withAlpha('--racing-50'),
          100: withAlpha('--racing-100'),
          200: withAlpha('--racing-200'),
          300: withAlpha('--racing-300'),
          400: withAlpha('--racing-400'),
          500: withAlpha('--racing-500'),
          600: withAlpha('--racing-600'),
          700: withAlpha('--racing-700'),
          800: withAlpha('--racing-800'),
          900: withAlpha('--racing-900'),
          950: withAlpha('--racing-950'),
        },
      },
    },
  },
  plugins: [],
}
