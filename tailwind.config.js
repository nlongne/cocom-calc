/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./node_modules/@(lucide-react|@radix-ui|class-variance-authority|tailwind-merge|tailwindcss-animate)/**/*.js",
  ],
  theme: {
    extend: {
      colors: { brand: { blue: "#1C3256" } },
      borderRadius: { xl: "0.75rem", "2xl": "1rem" },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

