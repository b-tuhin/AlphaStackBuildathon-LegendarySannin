import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 160, maxHeight: 220, placement: "bottom" });

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_HEIGHT = 220;
    const MARGIN = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement = "bottom";
    let top = rect.bottom + MARGIN;
    let maxHeight = Math.min(MENU_HEIGHT, Math.max(80, spaceBelow - MARGIN - 8));

    // Open downward by default and flip upward only when there's genuinely no room below
    if (spaceBelow < Math.min(MENU_HEIGHT, 150) + MARGIN && spaceAbove > spaceBelow) {
      placement = "top";
      maxHeight = Math.min(MENU_HEIGHT, Math.max(80, spaceAbove - MARGIN - 8));
      const actualHeight = menuRef.current?.offsetHeight || maxHeight;
      top = rect.top - actualHeight - MARGIN;
    }

    const minWidth = Math.max(rect.width, 160);
    let left = rect.left;
    // Clamp horizontal position within viewport
    if (left + minWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minWidth - 8);
    }
    if (left < 8) {
      left = 8;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      minWidth: Math.round(minWidth),
      maxHeight: Math.round(maxHeight),
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  // Handle outside click, scroll, resize, escape
  useEffect(() => {
    if (!open) return;

    let rafId = null;
    const handleScrollOrResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    };

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  const selectedOpt = options.find((o) => (o.value ?? o.code) === value);
  const displayLabel = selectedOpt ? selectedOpt.label || selectedOpt.name : placeholder;

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

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
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
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

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          data-themed-select-menu="true"
          className="themed-menu-scrollbar"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            minWidth: coords.minWidth,
            maxHeight: coords.maxHeight,
            overflowY: "auto",
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "var(--shadow-sm)",
            zIndex: 99999,
            padding: "4px 0",
            display: "flex",
            flexDirection: "column",
            scrollbarWidth: "thin",
            scrollbarColor: `${colors.borderStrong} ${colors.surface}`,
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
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(optVal);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(optVal);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: isSelected ? colors.accent : colors.textPrimary,
                  background: isSelected ? colors.accentLight : "transparent",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "background 100ms ease",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{opt.label || opt.name}</span>
                {isSelected && <Check size={14} strokeWidth={2.5} color={colors.accent} />}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
