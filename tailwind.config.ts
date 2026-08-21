import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        negative: "var(--negative)",
        positive: "var(--positive)",
        "data-purple": "var(--data-purple)",
        "data-slate": "var(--data-slate)",
        "data-neutral": "var(--data-neutral)",
      },
      fontFamily: {
        sans: ["Outfit Variable", "Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 44px rgba(33, 34, 34, 0.07)",
        floating: "0 10px 24px rgba(33, 34, 34, 0.09)",
      },
    },
  },
  plugins: [],
};

export default config;
