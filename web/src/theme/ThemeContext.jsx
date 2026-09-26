import React, { createContext, useContext, useState, useEffect } from "react";

/**
 * Calm, trustworthy palette — muted blue/slate/green tones.
 * WCAG AA compliant contrast ratios throughout.
 */
export const lightColors = {
  // ── Surfaces ────────────────────────────────────────────────────────────────
  bg:            "#f0f2f5",       // page canvas — cool off-white
  surface:       "#ffffff",       // panels, cards, modals
  surfaceAlt:    "#f4f6f9",       // input fills, chip backgrounds
  surfaceHover:  "#e8eef7",       // row hover / highlight
  border:        "#d9dde8",       // dividers
  borderStrong:  "#b8c0d0",       // input borders, focused ring

  // ── Typography ──────────────────────────────────────────────────────────────
  textPrimary:   "#1a2030",       // near-black slate — 12:1 contrast on white
  textSecondary: "#5a677d",       // secondary labels — 4.8:1 on white
  textMuted:     "#3d4a5c",       // medium-emphasis
  textAccent:    "#1d4ed8",       // interactive text links

  // ── Brand / interactive ─────────────────────────────────────────────────────
  accent:        "#2563eb",       // primary action — 5.0:1 on white (pass)
  accentLight:   "#dbeafe",       // selected row bg, chip active bg
  accentChip:    "#bfdbfe",       // chip active
  accentChipFg:  "#1e3a8a",       // chip active text

  // ── Status ───────────────────────────────────────────────────────────────────
  danger:        "#b91c1c",       // error text — 7.1:1 on white (pass)
  dangerBg:      "#fee2e2",
  success:       "#15803d",       // success text — 5.5:1 (pass)
  successBg:     "#dcfce7",
  warningFg:     "#b45309",

  // ── Switches ──────────────────────────────────────────────────────────────────
  switchTrackOn:  "#2563eb",
  switchTrackOff: "#94a3b8",
  switchKnob:     "#ffffff",

  // ── Chat bubbles ─────────────────────────────────────────────────────────────
  bubbleOut:            "#dbeafe",     // outgoing — soft blue
  bubbleIn:             "#ffffff",     // incoming — white
  bubbleBorderOut:      "#bfdbfe",
  bubbleBorderIn:       "#d9dde8",
  quoteBackground:      "#f4f6f9",
  quoteBorder:          "#2563eb",
  favoriteBubbleBg:     "#fffbeb",     // subtle warm amber tint
  favoriteBubbleBorder: "#fde68a",     // warm amber border
  favoriteBubbleGlow:   "0 2px 8px rgba(217, 119, 6, 0.12)",
  highlightBg:          "#fef3c7",     // calm muted amber highlight
  highlightBorder:      "#f59e0b",
  highlightGlow:        "0 0 0 3px rgba(245, 158, 11, 0.25), 0 4px 12px rgba(0, 0, 0, 0.08)",
};

export const darkColors = {
  bg:            "#0f1520",
  surface:       "#1a2236",
  surfaceAlt:    "#232d42",
  surfaceHover:  "#1e2d4f",
  border:        "#2a3550",
  borderStrong:  "#374463",

  textPrimary:   "#e2e8f4",       // 12:1 on #1a2236 (pass)
  textSecondary: "#8a9ab8",       // 4.5:1 (pass)
  textMuted:     "#aab4cc",
  textAccent:    "#93b4fa",

  accent:        "#6090f5",       // 4.5:1 on dark surface (pass)
  accentLight:   "#1e2d4f",
  accentChip:    "#1e3460",
  accentChipFg:  "#bfdbfe",

  danger:        "#f87171",
  dangerBg:      "#3b1c1c",
  success:       "#86efac",
  successBg:     "#14432a",
  warningFg:     "#fbbf24",

  switchTrackOn:  "#6090f5",
  switchTrackOff: "#4a5568",
  switchKnob:     "#ffffff",

  bubbleOut:            "#1e3460",
  bubbleIn:             "#1a2236",
  bubbleBorderOut:      "#2a4070",
  bubbleBorderIn:       "#2a3550",
  quoteBackground:      "#232d42",
  quoteBorder:          "#6090f5",
  favoriteBubbleBg:     "#292419",     // subtle warm dark amber tint
  favoriteBubbleBorder: "#52431f",     // warm dark amber border
  favoriteBubbleGlow:   "0 2px 10px rgba(245, 158, 11, 0.15)",
  highlightBg:          "#382d15",     // calm dark amber highlight
  highlightBorder:      "#d97706",
  highlightGlow:        "0 0 0 3px rgba(245, 158, 11, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)",
};

const STORAGE_KEY = "phonemail_web_theme";

export const ThemeContext = createContext({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark";
    } catch {
      return false;
    }
  });

  const setTheme = (dark) => {
    setIsDark(dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {}
  };

  const toggleTheme = () => setTheme(!isDark);

  const colors = isDark ? darkColors : lightColors;

  // Inject CSS custom properties so CSS classes (.sidebar-item--active, etc.) can read them
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bg", colors.bg);
    root.style.setProperty("--surface", colors.surface);
    root.style.setProperty("--surface-hover", colors.surfaceHover);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-light", colors.accentLight);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--border-strong", colors.borderStrong);
    root.style.setProperty("--text-primary", colors.textPrimary);
    root.style.setProperty("--text-secondary", colors.textSecondary);
    root.style.setProperty("--danger", colors.danger);
    root.style.setProperty("--danger-bg", colors.dangerBg);
    root.style.setProperty("--highlight-bg", colors.highlightBg);
    root.style.setProperty("--highlight-border", colors.highlightBorder);
    root.style.setProperty("--highlight-glow", colors.highlightGlow);
    root.style.background = colors.bg;
    root.style.color = colors.textPrimary;
  }, [isDark, colors]);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
