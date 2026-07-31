import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0E12",
        panel: "#14191F",
        elevated: "#1B222B",
        ink: "#0F1217",
        mist: "#1B222B",
        line: "#303943",
        aqua: "#20B8AE",
        coral: "#FF745F",
        berry: "#D9467A",
        leaf: "#16A34A",
        amber: "#F59E0B"
      },
      boxShadow: {
        soft: "0 10px 24px rgba(0, 0, 0, 0.20)",
        deep: "0 18px 50px rgba(0, 0, 0, 0.26)"
      }
    }
  },
  plugins: []
};

export default config;
