import React from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

const FILTERS = [
  { key: "all",         labelKey: "filterAll",         title: "All conversations" },
  { key: "unread",      labelKey: "filterUnread",      title: "Unread conversations" },
  { key: "attachments", labelKey: "filterAttachments", title: "Conversations with attachments" },
  { key: "favorites",   labelKey: "filterImportant",   title: "Conversations with an important message" },
];

export default function FilterChips({ active, onChange }) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <div
      className="filter-chips-scroll"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 56,
        boxSizing: "border-box",
        padding: "0 16px",
        paddingRight: 16,
        overflowX: "auto",
        scrollSnapType: "none",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
        flexShrink: 0,
      }}
    >
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        const isImportantChip = f.key === "favorites";
        return (
          <button
            key={f.key}
            type="button"
            title={f.title}
            onClick={() => onChange(f.key)}
            className={`filter-chip${isActive ? " filter-chip--active" : ""}`}
            style={{
              padding: "0 16px",
              height: 40,
              minHeight: 40,
              boxSizing: "border-box",
              borderRadius: 999,
              border: isActive && isImportantChip ? "1px solid var(--important)" : "none",
              background: isActive ? "var(--primary-tint)" : "var(--raised)",
              color: isActive ? "var(--link)" : "var(--muted)",
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t(f.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
