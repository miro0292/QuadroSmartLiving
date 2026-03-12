/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        brand: ['Montserrat', 'sans-serif'],
      },
      colors: {
        brand: {
          50: "#fff8e8",
          100: "#fbecc8",
          200: "#f3d997",
          300: "#e9c160",
          400: "#d6ad4d",
          500: "#c79b35",
          600: "#b2852a",
          700: "#8f671f",
          800: "#6f4f1a",
          900: "#5a3f17"
        }
      }
    },
  },
  plugins: [],
}

