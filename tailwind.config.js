/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4772FA',
          light: '#6E8FFF',
          dark: '#3457D5',
        },
        racing: {
          50: '#E6EFEA',
          100: '#C2D9CC',
          200: '#8FB9A1',
          300: '#5C9A77',
          400: '#2F7752',
          500: '#1B5E3C',
          600: '#155034',
          700: '#0F3D29',
          800: '#0B2E1F',
          900: '#082218',
          950: '#04140E',
        },
      },
    },
  },
  plugins: [],
}
