import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B1120",
        surface: "#131C31",
        "blue-dark": "#1E40AF",
        "blue-primary": "#1D4ED8",
        "blue-light": "#3B82F6",
        "green-primary": "#22C55E",
        "green-light": "#4ADE80",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      // Added the missing animation definition
      keyframes: {
        'ping-once': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        }
      },
      animation: {
        'ping-once': 'ping-once 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
export default config;