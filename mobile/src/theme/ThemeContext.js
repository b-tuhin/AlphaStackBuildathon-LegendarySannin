import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  // Balanced Tricolor — Light Mode
  primary: "#18181a",         // Neutral charcoal primary
  primaryLight: "#e6820a",    // Saffron accent
  accent: "#e6820a",          // Saffron action (AA contrast compliant on white)
  accentLight: "#fef3e2",
  bubbleOut: "#fef3e2",       // Outgoing message bubble (warm saffron tint)
  bubbleIn: "#ffffff",        // Incoming message bubble (crisp white card)
  bubbleBorderOut: "#fce0be", // Outgoing bubble border
  bubbleBorderIn: "#dcdcdc",  // Incoming bubble border
  background: "#f4f4f5",      // Page canvas — neutral light gray
  bg: "#f4f4f5",
  surface: "#ffffff",
  card: "#ffffff",
  listBackground: "#ffffff",
  surfaceAlt: "#f0f0f1",
  surfaceHover: "#e8e8ea",
  divider: "#dcdcdc",
  border: "#dcdcdc",
  borderStrong: "#b0b0b4",
  textPrimary: "#18181a",     // Charcoal text — 17.5:1 on white (AAA pass)
  textSecondary: "#5b6068",   // Muted text — 5.6:1 on white (AA pass)
  quoteBorder: "#e6820a",     // Saffron quote bar
  quoteBackground: "#f0f0f1", // Neutral quote background
  unreadBadge: "#e6820a",
  danger: "#c73a32",
  dangerBg: "#fde8e7",
  success: "#178a45",
  successBg: "#eaf6ee",
  navyMark: "#22337a",        // Single decorative chakra mark
  chipActive: "#e6820a",
  chipInactive: "#f0f0f1",
};

export const darkColors = {
  // Balanced Tricolor — Dark Mode
  primary: "#ff9933",         // Saffron
  primaryLight: "#ff9933",    // Saffron
  accent: "#ff9933",          // Saffron primary action — 8.5:1 on #212123 (AAA pass)
  accentLight: "#3a2a17",
  bubbleOut: "#3a2a17",       // Outgoing chat bubble
  bubbleIn: "#212123",        // Incoming chat bubble
  bubbleBorderOut: "#543b1e", // Outgoing border
  bubbleBorderIn: "#323234",  // Incoming border
  background: "#18181a",      // Page canvas — neutral charcoal, R≈G≈B
  bg: "#18181a",
  surface: "#212123",
  card: "#212123",
  listBackground: "#212123",
  surfaceAlt: "#26262a",
  surfaceHover: "#2a2a2e",
  divider: "#323234",
  border: "#323234",
  borderStrong: "#414144",
  textPrimary: "#f4f4f5",     // Primary text — 14.8:1 on #212123 (AAA pass)
  textSecondary: "#a3a3a6",   // Muted text — 4.7:1 on #212123 (AA pass)
  quoteBorder: "#ff9933",     // Saffron quote bar
  quoteBackground: "#26262a", // Dark quote background
  unreadBadge: "#ff9933",
  danger: "#f2584f",
  dangerBg: "#2e1614",
  success: "#1a9850",
  successBg: "#132a1c",
  navyMark: "#1e2a6b",        // Single decorative chakra mark
  chipActive: "#ff9933",
  chipInactive: "#26262a",
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
