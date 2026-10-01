import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";

export default function ThemeToggle({ id, style }) {
  const { isDark, toggleTheme, colors } = useTheme();

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="theme-toggle-pill"
      style={{
        background: colors.surfaceAlt,
        borderColor: colors.borderStrong,
        ...style,
      }}
    >
      <div
        className="theme-toggle-knob"
        style={{
          transform: isDark ? "translateX(24px)" : "translateX(0)",
          background: colors.surface,
          boxShadow: isDark
            ? "none"
            : "var(--shadow-sm)",
        }}
      >
        {isDark ? (
          <Moon
            size={13}
            color={colors.accent}
            strokeWidth={2.2}
            className="theme-toggle-icon"
            style={{ transform: "rotate(0deg)" }}
          />
        ) : (
          <Sun
            size={13}
            color={colors.accent}
            strokeWidth={2.2}
            className="theme-toggle-icon"
            style={{ transform: "rotate(0deg)" }}
          />
        )}
      </div>
    </button>
  );
}
