import type { Config } from "tailwindcss";

const config: Config = {
  // OS の設定に関わらず常にライトモードで表示する (dark: は class 方式にして .dark を付けない)
  darkMode: 'class',
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#2563eb",
        midori: "#16a34a",
        kohei: "#0891b2",
      },
    },
  },
  plugins: [],
};
export default config;
