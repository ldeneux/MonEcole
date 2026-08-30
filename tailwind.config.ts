import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ardoise: {
          50: "#f2f6f5",
          100: "#dfe9e6",
          200: "#b9d0ca",
          300: "#8fb3a9",
          400: "#5f8f81",
          500: "#3f7264",
          600: "#2f5b4f",
          700: "#264a41",
          800: "#1e3b34",
          900: "#152d28"
        },
        craie: "#faf7f0",
        encre: "#20221f",
        corail: "#e0724a"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      }
    }
  },
  plugins: []
};
export default config;
