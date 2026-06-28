/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#101415",
        surface: {
          DEFAULT: "#101415",
          container: {
            lowest: "#0b0f10",
            low: "#191c1e",
            DEFAULT: "#1d2022",
            high: "#272a2c",
            highest: "#323537",
          }
        },
        primary: {
          DEFAULT: "#bec6e0",
          cyan: "#06B6D4",
        },
        medical: {
          success: "#34d399",
          warning: "#fbbf24",
          error: "#f43f5e",
        },
        text: {
          primary: "#e0e3e5",
          muted: "#94a3b8",
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      }
    },
  },
  plugins: [],
}