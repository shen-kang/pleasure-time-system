import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0D0F0E",
        panel: "#151817",
        elevated: "#202421",
        ink: "#101312",
        mist: "#202421",
        line: "#343936",
        aqua: "#42C7BA",
        coral: "#FF7664",
        berry: "#D9467A",
        leaf: "#16A34A",
        amber: "#F59E0B"
      },
      boxShadow: {
        soft: "0 8px 22px rgba(0, 0, 0, 0.20)",
        deep: "0 18px 48px rgba(0, 0, 0, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
