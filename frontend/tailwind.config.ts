import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0b0f",
        surface: "#12131a",
        border: "#2a2b38",
        "text-primary": "#e8e9f0",
        "text-muted": "#6b7280",
        accent: "#3b82f6",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
