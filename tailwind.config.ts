import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        smoke: {
          50: "#f1f7f0",
          100: "#dfeede",
          200: "#bcdcb9",
          300: "#8fc28b",
          400: "#5fa05a",
          500: "#3f8038",
          600: "#2d6628",
          700: "#234f1f",
          800: "#1c3d18",
          900: "#142c11",
          950: "#0a1908",
        },
      },
      fontFamily: {
        sans: [
          "Heebo",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      keyframes: {
        drift: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0.4" },
          "50%": { opacity: "0.7" },
          "100%": { transform: "translateY(-200px) translateX(40px)", opacity: "0" },
        },
        sway: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(8px)" },
        },
      },
      animation: {
        drift: "drift 9s ease-in infinite",
        sway: "sway 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
