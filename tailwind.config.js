module.exports = {
  darkMode: "class",
  content: ["./*.html", "./app.js"],
  theme: {
    extend: {
      colors: {
        primary: "#002045",
        secondary: "#0a6c44",
        surface: "#f9f9ff",
        background: "#f9f9ff",
        brandDark: "#111111",
        brandAccent: "#0a6c44",
        neutralBg: "#f8f9fa"
      },
      fontFamily: {
        serif: ["Noto Serif KR", "Georgia", "serif"],
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ]
};
