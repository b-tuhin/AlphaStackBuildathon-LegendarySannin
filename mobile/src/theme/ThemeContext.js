import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  primary: "#1E293B",        // Spike clean slate header
  primaryLight: "#2563EB",   // Spike royal blue accent
  accent: "#2563EB",         // Spike action blue
  bubbleOut: "#EFF6FF",      // Clean light blue-tinted white for outgoing messages
  bubbleIn: "#FFFFFF",       // Clean crisp white for incoming messages
  bubbleBorderOut: "#DBEAFE", // Subtle 1px border for outgoing
  bubbleBorderIn: "#E2E8F0",  // Subtle 1px border for incoming
  background: "#F8FAFC",     // Crisp off-white chat wallpaper
  listBackground: "#FFFFFF",
  divider: "#E2E8F0",
  textPrimary: "#0F172A",    // Crisp slate text
  textSecondary: "#64748B",  // Muted slate text
  quoteBorder: "#2563EB",    // Spike blue quote bar
  quoteBackground: "#F1F5F9",// Subtle neutral quote background
  unreadBadge: "#2563EB",
  danger: "#EF4444",
  chipActive: "#2563EB",
  chipInactive: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",
};

export const darkColors = {
  primary: "#38BDF8",
  primaryLight: "#60A5FA",
  accent: "#38BDF8",
  bubbleOut: "#1E293B",
  bubbleIn: "#0F172A",
  bubbleBorderOut: "#334155",
  bubbleBorderIn: "#1E293B",
  background: "#0B0F19",
  listBackground: "#0F172A",
  divider: "#1E293B",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  quoteBorder: "#38BDF8",
  quoteBackground: "#1E293B",
  unreadBadge: "#38BDF8",
  danger: "#F87171",
  chipActive: "#38BDF8",
  chipInactive: "#1E293B",
  card: "#0F172A",
  border: "#334155",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const typography = {
  title: { fontSize: 18, fontWeight: "600", color: lightColors.textPrimary },
  body: { fontSize: 15, color: lightColors.textPrimary },
  caption: { fontSize: 12, color: lightColors.textSecondary },
};

// Default colors alias for backwards compatibility
export const colors = lightColors;

const THEME_STORAGE_KEY = "@phonemail_theme";

export const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  colors: lightColors,
  spacing,
  typography,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((val) => {
        if (val === "dark" || val === "light") {
          setThemeState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(() => {});
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";
  const currentColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        colors: currentColors,
        spacing,
        typography,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function createStyles(stylesFn) {
  return (colors) => stylesFn(colors);
}

export default {
  colors: lightColors,
  lightColors,
  darkColors,
  spacing,
  typography,
  useTheme,
  ThemeProvider,
  ThemeContext,
  createStyles,
};
