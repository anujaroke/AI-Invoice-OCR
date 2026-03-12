/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0F1B35',
        darkCard: '#162040',
        cyan: '#06B6D4',
        slateGray: '#94A3B8',
      },
    },
  },
  plugins: [],
}
