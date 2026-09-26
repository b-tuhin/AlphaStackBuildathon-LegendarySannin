import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { ChevronDown, Check } from "lucide-react";

export default function ThemedSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  style = {},
  triggerStyle = {},
  menuStyle = {},
  title,
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectedOpt = options.find((o) => (o.value ?? o.code) === value);
  const displayLabel = selectedOpt ? selectedOpt.label || selectedOpt.name : placeholder;

  const handleSelect = (val) => {
    if (disabled) return;
    onChange(val);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          background: "transparent",
          border: "none",
          padding: "2px 4px",
          color: colors.textPrimary,
          fontSize: 12,
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          borderRadius: 6,
          outline: "none",
          ...triggerStyle,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayLabel}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          color={colors.textSecondary}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            minWidth: 160,
            maxHeight: 220,
            overflowY: "auto",
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 3500,
            padding: "4px 0",
            display: "flex",
            flexDirection: "column",
            ...menuStyle,
          }}
        >
          {options.map((opt) => {
            const optVal = opt.value ?? opt.code;
            const isSelected = optVal === value;
            return (
              <div
                key={optVal}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(optVal)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: isSelected ? colors.accent : colors.textPrimary,
                  background: isSelected ? colors.accentLight : "transparent",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{opt.label || opt.name}</span>
                {isSelected && <Check size={13} strokeWidth={2.5} color={colors.accent} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
