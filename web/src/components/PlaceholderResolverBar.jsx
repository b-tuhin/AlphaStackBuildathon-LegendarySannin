import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ComposeIcon from "./ComposeIcon.jsx";

import { useTheme } from "../theme/ThemeContext.jsx";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function classifyPlaceholder(bracketStr) {
  const content = bracketStr.slice(1, -1).toLowerCase();
  if (content.includes("date") || content.includes("day")) {
    return "date";
  }
  if (content.includes("time")) {
    return "time";
  }
  if (content.includes("name")) {
    return "name";
  }
  if (
    content.includes("place") ||
    content.includes("location") ||
    content.includes("address")
  ) {
    return "place";
  }
  return "text";
}

function formatLabel(bracketStr) {
  let content = bracketStr.slice(1, -1).trim();
  // Strip leading "insert" or "your" if present
  content = content.replace(/^(insert|your)\s+/i, "");
  // Take first clause before commas, semicolons, or "e.g."
  content = content.split(/[,;]|e\.g\./i)[0].trim();
  if (!content) content = "Details";
  // Capitalize first letter
  content = content.charAt(0).toUpperCase() + content.slice(1);
  if (content.length > 22) {
    return content.slice(0, 20) + "…";
  }
  return content;
}

export default function PlaceholderResolverBar({ text, onChange }) {
  const { colors } = useTheme();
  const [activeItem, setActiveItem] = useState(null);
  const barRef = useRef(null);

  // Scan text for bracket placeholders using /\[[^\]]+\]/g
  const placeholders = useMemo(() => {
    if (!text || typeof text !== "string") return [];
    const regex = /\[[^\]]+\]/g;
    const list = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      list.push({
        fullMatch: match[0],
        index: match.index,
        type: classifyPlaceholder(match[0]),
        label: formatLabel(match[0]),
      });
    }
    return list;
  }, [text]);

  // If activeItem is no longer present in text, clear it
  useEffect(() => {
    if (activeItem) {
      const stillExists = placeholders.some(
        (p) => p.fullMatch === activeItem.fullMatch
      );
      if (!stillExists) {
        setActiveItem(null);
      }
    }
  }, [placeholders, activeItem]);

  // Outside click & Escape to dismiss popover
  useEffect(() => {
    if (!activeItem) return;

    const handleOutsideClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setActiveItem(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveItem(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItem]);

  if (placeholders.length === 0) {
    return null;
  }

  const handleResolve = (item, replacement) => {
    if (!replacement) return;
    const idx = text.indexOf(item.fullMatch);
    let newText;
    if (idx !== -1) {
      newText =
        text.slice(0, idx) +
        replacement +
        text.slice(idx + item.fullMatch.length);
    } else {
      newText = text.replace(item.fullMatch, replacement);
    }
    onChange(newText);
    setActiveItem(null);
  };

  return (
    <div
      ref={barRef}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        padding: "6px 8px 4px 8px",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: colors.textSecondary,
          marginRight: 2,
          userSelect: "none",
        }}
      >
        Fill in:
      </span>

      {placeholders.map((item, idx) => {
        const isActive =
          activeItem?.fullMatch === item.fullMatch &&
          activeItem?.index === item.index;

        return (
          <ChipItem
            key={`${item.fullMatch}-${item.index}-${idx}`}
            item={item}
            isActive={isActive}
            colors={colors}
            onToggle={() => setActiveItem(isActive ? null : item)}
            onResolve={(replacement) => handleResolve(item, replacement)}
            onClose={() => setActiveItem(null)}
          />
        );
      })}
    </div>
  );
}

function ChipItem({ item, isActive, colors, onToggle, onResolve, onClose }) {
  const chipRef = useRef(null);
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (isActive && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      const popoverWidth = item.type === "date" ? 260 : item.type === "time" ? 210 : 240;
      setAlignRight(window.innerWidth - rect.left < popoverWidth + 20);
    }
  }, [isActive, item.type]);

  return (
    <div ref={chipRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 500,
          background: isActive ? colors.accentLight : colors.surfaceAlt,
          color: isActive ? colors.accent : colors.textPrimary,
          border: `1px solid ${isActive ? colors.accent : colors.borderStrong}`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
        title={`Click to fill in ${item.fullMatch}`}
        aria-label={`Fill in ${item.label}`}
        aria-expanded={isActive}
      >
        {item.type === "date" && <Calendar size={12} strokeWidth={2} />}
        {item.type === "time" && <Clock size={12} strokeWidth={2} />}
        {item.type === "name" && <User size={12} strokeWidth={2} />}
        {item.type === "place" && <MapPin size={12} strokeWidth={2} />}
        {item.type === "text" && <ComposeIcon size={12} strokeWidth={2} />}
        <span>{item.label}</span>
      </button>

      {isActive && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            ...(alignRight ? { right: 0 } : { left: 0 }),
            zIndex: 2500,
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 10,
            boxShadow: "var(--shadow-sm)",
            padding: 12,
            boxSizing: "border-box",
          }}
        >
          {item.type === "date" && (
            <CalendarPopover
              colors={colors}
              onSelect={onResolve}
              onClose={onClose}
            />
          )}
          {item.type === "time" && (
            <TimePickerPopover
              colors={colors}
              onSelect={onResolve}
              onClose={onClose}
            />
          )}
          {(item.type === "name" ||
            item.type === "place" ||
            item.type === "text") && (
            <TextInputPopover
              colors={colors}
              type={item.type}
              label={item.label}
              onSelect={onResolve}
              onClose={onClose}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Custom Calendar Popover (Plain Date Math, Zero Native Pickers) ─────────────
function CalendarPopover({ colors, onSelect, onClose }) {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (e, day) => {
    e.stopPropagation();
    const formatted = `${day} ${MONTH_NAMES[month]} ${year}`;
    onSelect(formatted);
  };

  return (
    <div style={{ width: 238, userSelect: "none" }}>
      {/* Month / Year header with navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={handlePrevMonth}
          style={{
            background: "none",
            border: "none",
            color: colors.textPrimary,
            cursor: "pointer",
            padding: "4px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Previous month"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
          {MONTH_NAMES[month]} {year}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          style={{
            background: "none",
            border: "none",
            color: colors.textPrimary,
            cursor: "pointer",
            padding: "4px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Next month"
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: colors.textSecondary,
              padding: "2px 0",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} style={{ height: 28 }} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday =
            year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate();

          return (
            <button
              key={day}
              type="button"
              onClick={(e) => handleDayClick(e, day)}
              style={{
                height: 28,
                width: 28,
                borderRadius: 6,
                border: isToday ? `1px solid ${colors.accent}` : "none",
                background: "transparent",
                color: isToday ? colors.accent : colors.textPrimary,
                fontSize: 12,
                fontWeight: isToday ? 700 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accent;
                e.currentTarget.style.color = "var(--on-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = isToday
                  ? colors.accent
                  : colors.textPrimary;
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom Time Picker Popover (Zero Native Pickers) ─────────────────────────
function TimePickerPopover({ colors, onSelect, onClose }) {
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(30);
  const [period, setPeriod] = useState("AM");

  const handleInsert = (e) => {
    e.stopPropagation();
    const formatted = `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
    onSelect(formatted);
  };

  const adjustHour = (e, delta) => {
    e.stopPropagation();
    setHour((prev) => {
      let next = prev + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      return next;
    });
  };

  const adjustMinute = (e, delta) => {
    e.stopPropagation();
    setMinute((prev) => {
      let next = prev + delta;
      if (next >= 60) next = 0;
      if (next < 0) next = 55;
      return next;
    });
  };

  return (
    <div style={{ width: 190, userSelect: "none" }}>
      {/* Time Display Preview */}
      <div
        style={{
          textAlign: "center",
          fontSize: 18,
          fontWeight: 700,
          color: colors.accent,
          marginBottom: 12,
          letterSpacing: "0.5px",
        }}
      >
        {hour}:{minute.toString().padStart(2, "0")} {period}
      </div>

      {/* Adjusters Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {/* Hour column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <button
            type="button"
            onClick={(e) => adjustHour(e, 1)}
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.textPrimary,
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            +
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
            {hour}
          </span>
          <button
            type="button"
            onClick={(e) => adjustHour(e, -1)}
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.textPrimary,
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            -
          </button>
        </div>

        <span style={{ fontSize: 16, fontWeight: 700, color: colors.textSecondary }}>:</span>

        {/* Minute column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <button
            type="button"
            onClick={(e) => adjustMinute(e, 5)}
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.textPrimary,
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            +
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
            {minute.toString().padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={(e) => adjustMinute(e, -5)}
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.textPrimary,
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            -
          </button>
        </div>

        {/* AM / PM Toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginLeft: 4 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPeriod("AM");
            }}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              border: `1px solid ${period === "AM" ? colors.accent : colors.border}`,
              background: period === "AM" ? colors.accent : colors.surfaceAlt,
              color: period === "AM" ? "var(--on-primary)" : colors.textPrimary,
              cursor: "pointer",
            }}
          >
            AM
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPeriod("PM");
            }}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              border: `1px solid ${period === "PM" ? colors.accent : colors.border}`,
              background: period === "PM" ? colors.accent : colors.surfaceAlt,
              color: period === "PM" ? "var(--on-primary)" : colors.textPrimary,
              cursor: "pointer",
            }}
          >
            PM
          </button>
        </div>
      </div>

      {/* Insert Button */}
      <button
        type="button"
        onClick={handleInsert}
        style={{
          width: "100%",
          padding: "5px 0",
          borderRadius: 6,
          background: colors.accent,
          color: "var(--on-primary)",
          border: "none",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          marginTop: 2,
        }}
      >
        Insert Time
      </button>
    </div>
  );
}

// ── Custom Text / Name / Location Popover ─────────────────────────────────────
function TextInputPopover({ colors, type, label, onSelect, onClose }) {
  const [val, setVal] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInsert = (e) => {
    if (e) e.stopPropagation();
    const trimmed = val.trim();
    if (trimmed) {
      onSelect(trimmed);
    }
  };

  const placeholderText =
    type === "name"
      ? "Enter name…"
      : type === "place"
      ? "Enter location…"
      : `Enter ${label.toLowerCase()}…`;

  return (
    <div style={{ width: 220 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 8,
        }}
      >
        Fill in {label}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleInsert(e);
            }
          }}
          placeholder={placeholderText}
          style={{
            flex: 1,
            padding: "5px 8px",
            fontSize: 12,
            borderRadius: 6,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.surfaceAlt,
            color: colors.textPrimary,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={handleInsert}
          disabled={!val.trim()}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            background: val.trim() ? colors.accent : colors.surfaceAlt,
            color: val.trim() ? "var(--on-primary)" : colors.textSecondary,
            border: `1px solid ${val.trim() ? colors.accent : colors.border}`,
            fontSize: 12,
            fontWeight: 600,
            cursor: val.trim() ? "pointer" : "default",
            whiteSpace: "nowrap",
          }}
        >
          Insert
        </button>
      </div>
    </div>
  );
}
