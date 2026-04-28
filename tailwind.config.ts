import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6c47ff",
          50: "#f3f0ff",
          100: "#e9e4ff",
          200: "#d4caff",
          500: "#6c47ff",
          600: "#5835e0",
          700: "#4527b8",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dde1e8",
          300: "#c2c8d2",
          400: "#8a93a3",
          500: "#5a6372",
          600: "#3f4856",
          700: "#2b323d",
          800: "#1b2028",
          900: "#0e1217",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
