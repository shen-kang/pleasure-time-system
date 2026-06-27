import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151719",
        mist: "#F5F7FA",
        line: "#DDE3EA",
        aqua: "#0EA5A4",
        coral: "#F9735B",
        berry: "#D9467A",
        leaf: "#16A34A",
        amber: "#F59E0B"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
