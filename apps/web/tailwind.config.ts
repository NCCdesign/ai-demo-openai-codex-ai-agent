import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#151515",
        mist: "#f5f5f7",
        line: "rgba(0,0,0,0.08)"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0,0,0,0.08)"
      }
    }
  },
  plugins: []
};

export default config;

