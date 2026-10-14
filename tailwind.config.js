/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0c0e',
          900: '#111316',
          850: '#17191c',
          800: '#1d2024',
          700: '#2a2e33',
          600: '#3a3f46',
          500: '#5b626b',
          400: '#8a919a',
          300: '#b4bac1',
          200: '#d7dbe0',
          100: '#eef0f2',
        },
        lime: {
          300: '#d9f99d',
          400: '#bef264',
          500: '#a3e635',
          600: '#84cc16',
          700: '#4d7c0f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
