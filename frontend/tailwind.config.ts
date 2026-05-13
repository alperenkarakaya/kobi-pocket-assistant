import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef3fe",
          100: "#d9e5fd",
          200: "#b3cbfb",
          300: "#7da6f7",
          400: "#4a81f0",
          500: "#0057e7",
          600: "#0049c5",
          700: "#003aa0",
          800: "#002c7b",
          900: "#001d55",
        },
        gsuccess: {
          50:  "#e8f5ee",
          100: "#c5e6d5",
          200: "#8dcbad",
          300: "#4baf84",
          400: "#1a9660",
          500: "#008744",
          600: "#006e37",
          700: "#00572c",
          800: "#003f1f",
          900: "#002912",
        },
        slate: {
          25: "#fafafa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        "card-lg": "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
