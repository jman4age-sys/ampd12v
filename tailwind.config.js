/** @type {import('tailwindcss').Config} */
export default {
  // Covers both layouts: files at the repo root (App.jsx, main.jsx) AND files
  // tidied into src/. Adding a new component won't silently lose its styling.
  content: [
    "./index.html",
    "./*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
