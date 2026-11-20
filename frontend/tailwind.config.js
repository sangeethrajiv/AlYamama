/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./apps/web/src/**/*.{html,ts}', './libs/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', 'sans-serif'], display: ['Manrope', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
    },
  },
  plugins: [],
};
