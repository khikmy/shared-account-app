import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#4f46e5",
        midori: "#16a34a",
        kohei: "#0891b2",
      },
    },
  },
  plugins: [],
};
export default config;
