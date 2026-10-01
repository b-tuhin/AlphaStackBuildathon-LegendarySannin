import React from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { Check } from "lucide-react";

export default function ThemedCheckbox({
  checked = false,
  onChange,
  disabled = false,
  size = 18,
  ariaLabel,
  title,
  style = {},
}) {
  const { colors } = useTheme();

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleClick(e);
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? colors.accent : "transparent",
        border: `1.5px solid ${checked ? colors.accent : colors.borderStrong}`,
        transition: "all 120ms ease",
        flexShrink: 0,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {checked && (
        <Check
          size={13}
          strokeWidth={3}
          color="var(--on-primary)"
          style={{ pointerEvents: "none" }}
        />
      )}
    </div>
  );
}
