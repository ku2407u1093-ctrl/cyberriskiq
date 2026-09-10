/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        panel: "#111a2e",
        panel2: "#16213a",
        accent: "#3b82f6",
        risk: "#ef4444",
        warn: "#f59e0b",
        safe: "#22c55e",
      },
    },
  },
  plugins: [],
};
