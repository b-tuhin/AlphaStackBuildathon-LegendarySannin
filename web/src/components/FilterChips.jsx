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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        overflowX: "auto",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
        flexShrink: 0,
      }}
    >
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            title={f.title}
            onClick={() => onChange(f.key)}
            className={`filter-chip${isActive ? " filter-chip--active" : ""}`}
            style={{
              padding: "5px 13px",
              borderRadius: 14,
              border: isActive ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
              background: isActive ? colors.accentLight : colors.surfaceAlt,
              color: isActive ? colors.textAccent : colors.textSecondary,
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
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
