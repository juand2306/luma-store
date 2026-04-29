/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  "#FAFAF8",
          100: "#F5F3EE",
          200: "#F0EDE7",
          300: "#E8E4DC",
          400: "#DDD9CF",
          500: "#CBC6BA",
        },
        teal: {
          50:  "#E6F4F4",
          100: "#CCE9E9",
          200: "#99D4D4",
          300: "#66BEBE",
          400: "#33A9A9",
          500: "#0D8585",
          600: "#0A6B6B",
          700: "#085252",
          800: "#053838",
          900: "#031F1F",
        },
        luma: {
          bg:      "#F0EDE7",
          card:    "#FFFFFF",
          border:  "#E4E0D9",
          text:    "#1C1C1E",
          muted:   "#71717A",
          faint:   "#A1A1AA",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        "card":     "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
        "card-md":  "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
        "card-lg":  "0 4px 16px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.08)",
        "modal":    "0 20px 60px rgba(0,0,0,0.15)",
      },
      animation: {
        "fade-in":      "fadeIn 0.3s ease-out",
        "fade-up":      "fadeUp 0.35s ease-out",
        "fade-down":    "fadeDown 0.3s ease-out",
        "slide-in":     "slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-right":  "slideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in":     "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft":   "pulseSoft 2s ease-in-out infinite",
        "shimmer":      "shimmer 1.8s infinite linear",
        "bounce-soft":  "bounceSoft 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        fadeUp:    { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeDown:  { from: { opacity: "0", transform: "translateY(-12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn:   { from: { opacity: "0", transform: "translateX(-16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        slideRight:{ from: { opacity: "0", transform: "translateX(100%)" }, to: { opacity: "1", transform: "translateX(0)" } },
        scaleIn:   { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        pulseSoft: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
        shimmer:   { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        bounceSoft:{ "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
      },
      transitionTimingFunction: {
        "spring":   "cubic-bezier(0.16, 1, 0.3, 1)",
        "smooth":   "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
}
