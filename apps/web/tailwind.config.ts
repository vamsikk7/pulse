import type { Config } from "tailwindcss";

/**
 * Pulse design tokens — Untitled-UI–style purple brand ramp with a neutral gray ramp.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary purple — #7f56d9 / #6941c6 / #5925dc
        brand: {
          25: "#fafaff",
          50: "#f4ebff",
          100: "#ebe9fe",
          200: "#d9d6fe",
          300: "#bdb4fe",
          400: "#9b8afb",
          500: "#7a5af8",
          600: "#6938ef",
          700: "#5925dc",
          800: "#4a1fb8",
          900: "#3e1c96",
        },
        // Neutral ramp — Untitled UI's gray scale
        gray: {
          25: "#fcfcfd",
          50: "#f9fafb",
          100: "#f2f4f7",
          200: "#eaecf0",
          300: "#d0d5dd",
          400: "#98a2b3",
          500: "#667085",
          600: "#475467",
          700: "#344054",
          800: "#1d2939",
          900: "#101828",
          950: "#0c111d",
        },
        success: {
          50: "#ecfdf3",
          200: "#abefc6",
          500: "#17b26a",
          700: "#067647",
          900: "#053321",
        },
        warning: {
          50: "#fffaeb",
          200: "#fedf89",
          500: "#f79009",
          700: "#b54708",
        },
        error: {
          50: "#fef3f2",
          200: "#fecdca",
          500: "#f04438",
          700: "#b42318",
          900: "#7a271a",
        },
        risk: {
          low: "#17b26a",
          med: "#f79009",
          high: "#f04438",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightish: "-0.01em",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
        sm: "0 1px 3px 0 rgba(16, 24, 40, 0.10), 0 1px 2px 0 rgba(16, 24, 40, 0.06)",
        md: "0 4px 8px -2px rgba(16, 24, 40, 0.10), 0 2px 4px -2px rgba(16, 24, 40, 0.06)",
        lg: "0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)",
        "brand-focus":
          "0 0 0 4px rgba(105, 56, 239, 0.18), 0 1px 2px 0 rgba(16,24,40,0.05)",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
