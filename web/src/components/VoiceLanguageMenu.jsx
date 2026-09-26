import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { VOICE_LANGUAGES, getSavedSpeechLang } from "../utils/speech.js";
import { Globe, ChevronDown, Check } from "lucide-react";

export default function VoiceLanguageMenu({
  value,
  onSelect,
  isOpen: controlledOpen,
  onClose: controlledClose,
  children,
  popupOnly = false,
  style = {},
  menuStyle = {},
  title = "Select speech language",
}) {
  const { colors } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next) => {
      if (!next && controlledClose) {
        controlledClose();
      }
      if (!isControlled) {
        setInternalOpen(next);
      }
    },
    [isControlled, controlledClose]
  );

  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const currentLang = value || getSavedSpeechLang();

  // Find index of current selected language
  const selectedIndex = VOICE_LANGUAGES.findIndex((l) => l.code === currentLang);
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  useEffect(() => {
    if (open) {
      const idx = VOICE_LANGUAGES.findIndex((l) => l.code === currentLang);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, currentLang]);

  // Outside click to close
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open, setOpen]);

  // Keyboard navigation: Escape, ArrowUp, ArrowDown, Enter
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % VOICE_LANGUAGES.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + VOICE_LANGUAGES.length) % VOICE_LANGUAGES.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const selected = VOICE_LANGUAGES[focusedIndex];
        if (selected && onSelect) {
          onSelect(selected.code);
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, focusedIndex, onSelect, setOpen]);

  // Auto-scroll focused item into view
  useEffect(() => {
    if (open && menuRef.current) {
      const itemEl = menuRef.current.children[focusedIndex];
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [open, focusedIndex]);

  const selectedOpt = VOICE_LANGUAGES.find((l) => l.code === currentLang) || VOICE_LANGUAGES[0];

  const handleItemClick = (code) => {
    if (onSelect) {
      onSelect(code);
    }
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        ...style,
      }}
    >
      {/* If children provided, render children as trigger */}
      {children ? (
        children
      ) : popupOnly ? null : (
        /* Standalone trigger button (used in ComposeModal) */
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title={title}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: colors.surfaceAlt,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 16,
            padding: "2px 8px",
            color: colors.textPrimary,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <Globe size={12} strokeWidth={2} color={colors.textSecondary} />
          <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOpt.label || selectedOpt.name}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={2}
            color={colors.textSecondary}
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 150ms ease",
            }}
          />
        </button>
      )}

      {/* Dropdown Popover */}
      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={title}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            minWidth: 170,
            maxHeight: 240,
            overflowY: "auto",
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 3500,
            padding: "4px 0",
            display: "flex",
            flexDirection: "column",
            ...menuStyle,
          }}
        >
          {VOICE_LANGUAGES.map((lang, idx) => {
            const isSelected = lang.code === currentLang;
            const isFocused = idx === focusedIndex;
            return (
              <div
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleItemClick(lang.code)}
                onMouseEnter={() => setFocusedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: isSelected ? colors.accent : colors.textPrimary,
                  background: isSelected
                    ? colors.accentLight
                    : isFocused
                    ? colors.surfaceHover
                    : "transparent",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "background 100ms ease",
                  userSelect: "none",
                }}
              >
                <span>{lang.label || lang.name}</span>
                {isSelected && <Check size={13} strokeWidth={2.5} color={colors.accent} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
