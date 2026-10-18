/** @type {import('tailwindcss').Config} */
module.exports = {
  // Use simple relative paths - these work best across different OS environments
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#15803d",
          light: "#22c55e",
          dark: "#166534"
        }
      }
    },
  },
  plugins: [],
};
