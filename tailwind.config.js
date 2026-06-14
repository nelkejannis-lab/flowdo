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
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'apple': '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'apple-md': '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'apple-lg': '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
      },
      backdropBlur: {
        'apple': '20px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
  },
  plugins: [],
}
