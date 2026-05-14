// src/lib/themes.js
// ─────────────────────────────────────────────────────────────────────────────
// Theme system for Mission Control (Mietorè).
// Each theme is a flat map of CSS variable values that override the defaults
// declared in index.css. The active theme is stored in localStorage and applied
// to <html data-theme="..."> on boot.
//
// Adding a theme: add an entry to THEMES, then add a matching
// `html[data-theme="<id>"] { ... }` rule in index.css.
// Components don't need to change — they read --mc-* via existing tokens.
// ─────────────────────────────────────────────────────────────────────────────

export const THEMES = [
  {
    id: "mietore",
    label: "Mietorè",
    sublabel: "Antique gold · luxury dark",
    description:
      "Antique gold on warm black with cyan reserved for live data. Calm, editorial, premium.",
    swatches: ["#D9A24C", "#F4C77A", "#22D3DB", "#0A0807"],
    preview: {
      bg: "linear-gradient(135deg, #100D0A 0%, #0A0807 100%)",
      accent: "#D9A24C",
      glow: "rgba(217, 162, 76, 0.45)",
    },
  },
  {
    id: "mietore-3d",
    label: "Mietorè · 3D",
    sublabel: "Gold with glass depth + glow",
    description:
      "Same antique gold palette, but with 3D glass panels, diagonal light streaks, lens flares, and animated shimmer.",
    swatches: ["#FCE6B8", "#F4C77A", "#D9A24C", "#8B6A3D"],
    preview: {
      bg: "linear-gradient(135deg, #1C1812 0%, #06040A 100%)",
      accent: "#F4C77A",
      glow: "rgba(244, 199, 122, 0.65)",
    },
  },
  {
    id: "neon",
    label: "Neon Glass",
    sublabel: "Cyan + violet · 3D",
    description:
      "Cyberpunk premium — frosted glass with cyan primary, violet secondary, and stacked depth shadows. Nebula background.",
    swatches: ["#22D3FF", "#67E8FF", "#B14BFF", "#D685FF"],
    preview: {
      bg: "linear-gradient(135deg, #0C0B14 0%, #04040A 100%)",
      accent: "#22D3FF",
      glow: "rgba(34, 211, 255, 0.65)",
    },
  },
];

export const DEFAULT_THEME = "mietore";
const STORAGE_KEY = "mc-theme";

export function getStoredTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t && THEMES.some((x) => x.id === t)) return t;
  } catch (_) {}
  return DEFAULT_THEME;
}

export function setStoredTheme(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (_) {}
}

// Apply theme to <html>. Safe to call before React mounts.
export function applyTheme(id) {
  const valid = THEMES.some((x) => x.id === id) ? id : DEFAULT_THEME;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", valid);
  }
  setStoredTheme(valid);
  // Notify any listeners (the switcher's preview, gateway, etc.)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mc-theme-change", { detail: { theme: valid } }));
  }
  return valid;
}

export function initTheme() {
  return applyTheme(getStoredTheme());
}

// React-friendly: subscribe to changes from anywhere
export function onThemeChange(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapper = (e) => handler(e.detail.theme);
  window.addEventListener("mc-theme-change", wrapper);
  return () => window.removeEventListener("mc-theme-change", wrapper);
}
