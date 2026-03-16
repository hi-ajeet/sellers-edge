/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'se-blue': '#0a64df',
        'se-teal': '#0bc5c5',
        'se-bg': '#0b0f1a',
        'se-surface': '#111827',
        'se-surface2': '#1a2235',
        'se-border': '#1e2d4a',
        'se-muted': '#6b7fa3',
        'se-sold': '#22c55e',
        'se-giveaway': '#f59e0b',
      },
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        'barlow-condensed': ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
