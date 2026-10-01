import React, { createContext, useContext, useState, useEffect } from "react";

/**
 * All colours are defined in src/theme/tokens.css.
 * The JS colors object maps component prop names to CSS variable references.
 * Components should use colors.X in inline styles; CSS rules use var(--token).
 */
const TOKEN_COLORS = {
  // Surfaces
  bg:             "var(--bg)",
  surface:        "var(--surface)",
  surfaceRaised:  "var(--raised)",
  surfaceAlt:     "var(--raised)",
  surfaceHover:   "var(--hover)",
  raised:         "var(--raised)",
  hover:          "var(--hover)",

  // Borders
  border:         "var(--border)",
  borderStrong:   "var(--border-strong)",

  // Typography
  textPrimary:    "var(--text)",
  textSecondary:  "var(--muted)",
  textMuted:      "var(--muted)",
  textAccent:     "var(--link)",
  text:           "var(--text)",
  muted:          "var(--muted)",
  link:           "var(--link)",

  // Brand / interactive
  primary:        "var(--primary)",
  accent:         "var(--primary)",
  accentLight:    "var(--primary-tint)",
  accentChip:     "var(--raised)",
  accentChipFg:   "var(--link)",
  navyMark:       "var(--primary)",
  onPrimary:      "var(--on-primary)",
  switchTrackOn:  "var(--primary)",
  switchTrackOff: "var(--border-strong)",
  switchKnob:     "var(--on-primary)",

  // Status
  danger:         "var(--danger)",
  dangerBg:       "var(--danger-bg)",
  success:        "var(--success)",
  successBg:      "var(--success-bg)",
  warningFg:      "var(--muted)",
  warningBg:      "var(--raised)",
  important:      "var(--important)",

  // Chat bubbles
  bubbleOut:            "var(--sent)",
  bubbleIn:             "var(--received)",
  bubbleBorderOut:      "var(--border)",
  bubbleBorderIn:       "var(--border)",
  quoteBackground:      "var(--primary-tint)",
  quoteBorder:          "var(--primary)",
  favoriteBubbleBg:     "var(--raised)",
  favoriteBubbleBorder: "var(--border)",
  favoriteBubbleGlow:   "var(--shadow-sm)",
  highlightBg:          "var(--primary-tint)",
  highlightBorder:      "var(--primary)",
  highlightGlow:        "var(--highlight-glow)",

  // Avatar
  avatarBg:       "var(--avatar-bg)",
  avatarFg:       "var(--avatar-fg)",
};

// Both themes return identical var() references — tokens.css handles the switch
export const lightColors = TOKEN_COLORS;
export const darkColors  = TOKEN_COLORS;

const STORAGE_KEY_THEME  = "theme";
const STORAGE_KEY_LEGACY = "phonemail_web_theme";

export const ThemeContext = createContext({
  isDark: false,
  themeMode: "light",
  setThemeMode: () => {},
  colors: TOKEN_COLORS,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem(STORAGE_KEY_LEGACY);
      if (stored === "dark" || stored === "light" || stored === "auto") return stored;
      return "light";
    } catch {
      return "light";
    }
  });

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = themeMode === "auto" ? systemDark : themeMode === "dark";

  const setThemeMode = (mode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
      const effectiveDark = mode === "auto"
        ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
        : mode === "dark";
      localStorage.setItem(STORAGE_KEY_LEGACY, effectiveDark ? "dark" : "light");
    } catch {}
  };

  const setTheme = (val) => {
    if (typeof val === "boolean") {
      setThemeMode(val ? "dark" : "light");
    } else if (val === "auto" || val === "dark" || val === "light") {
      setThemeMode(val);
    }
  };

  const toggleTheme = () => {
    setThemeMode(isDark ? "light" : "dark");
  };

  // Set data-theme attribute and update <meta name="theme-color">
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", isDark ? "dark" : "light");

    // Update theme-color meta from computed --bg token
    try {
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      let meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      if (bg) meta.content = bg;
    } catch {}
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, setThemeMode, colors: TOKEN_COLORS, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
