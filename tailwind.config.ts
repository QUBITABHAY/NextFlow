import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",

  theme: {
    extend: {
      // ─── Colors ────────────────────────────────────
      colors: {
        krea: {
          black: "#000000",
          surface: "#141414",
          elevated: "#1e1e1e",
          offwhite: "#f5f5f5",

          white: "#ffffff",
          muted: "#888888",
          subtle: "rgba(255, 255, 255, 0.3)",

          lime: "#c8ff57",
          "lime-dim": "#9ecc3a",
          violet: "#a78bfa",
          "violet-dim": "#7c5cf0",

          border: "rgba(255, 255, 255, 0.08)",
          "border-hover": "rgba(255, 255, 255, 0.15)",
          "border-active": "rgba(255, 255, 255, 0.25)",

          sidebar: "#000000",
          "sidebar-accent": "#1a1a1a",
        },
      },

      spacing: {
        "sidebar-expanded": "256px",
        "sidebar-collapsed": "52px",
        "4.5": "18px",
        "13": "52px",
        "15": "60px",
        "18": "72px",
      },

      // ─── Typography ────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },

      fontSize: {
        "display-lg": ["72px", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        display: ["48px", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
        "display-sm": [
          "36px",
          { lineHeight: "1.15", letterSpacing: "-0.02em" },
        ],
        heading: ["24px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        subheading: ["18px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        "body-lg": ["16px", { lineHeight: "1.6" }],
        body: ["14px", { lineHeight: "1.6" }],
        label: ["13px", { lineHeight: "1.4", letterSpacing: "0.04em" }],
        caption: ["11px", { lineHeight: "1.5", letterSpacing: "0.06em" }],
      },

      fontWeight: {
        normal: "400",
        medium: "500",
      },

      // ─── Border radius ─────────────────────────────
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
      },

      // ─── Shadows ───────────────────────────────────
      boxShadow: {
        "glow-lime": "0 0 20px rgba(200,255,87,0.25)",
        "glow-violet": "0 0 20px rgba(167,139,250,0.3)",
        "glow-subtle": "0 0 12px rgba(255,255,255,0.06)",
        "border-glass": "inset 0 0 0 0.5px rgba(255,255,255,0.12)",
      },

      // ─── Blur ──────────────────────────────────────
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "32px",
      },

      // ─── Transitions ───────────────────────────────
      transitionTimingFunction: {
        krea: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "100ms",
        slow: "300ms",
      },

      maxWidth: {
        content: "720px",
        wide: "1200px",
        canvas: "1440px",
      },

      // ─── Opacity ───────────────────────────────────
      opacity: {
        "3": "0.03",
        "7": "0.07",
        "12": "0.12",
        "15": "0.15",
        "25": "0.25",
      },

      // ─── Animations ────────────────────────────────
      animation: {
        "fade-in": "fadeIn 0.2s cubic-bezier(0.2,0,0,1)",
        "slide-up": "slideUp 0.25s cubic-bezier(0.2,0,0,1)",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },

  plugins: [],
};

export default config;
