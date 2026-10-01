import React from "react";
import { FileText, Trash2 } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Drafts folder: unsent messages saved when a compose window is closed. */
export default function DraftsList({ drafts, onOpen, onDelete }) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!drafts.length) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: colors.textSecondary, fontSize: 14 }}>
        {t("noDrafts")}
      </div>
    );
  }

  return (
    <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto" }}>
      {drafts.map((d) => (
        <div
          key={d.id}
          role="button"
          tabIndex={0}
          className="thread-row"
          onClick={() => onOpen(d)}
          onKeyDown={(e) => (e.key === "Enter" ? onOpen(d) : null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            cursor: "pointer",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: colors.surfaceAlt,
              color: colors.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={20} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: colors.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d.to || t("draftNoRecipient")}
              </span>
              <span style={{ fontSize: 11, color: colors.textSecondary, flexShrink: 0 }}>{formatWhen(d.updatedAt)}</span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.subject ? <strong style={{ color: colors.textPrimary }}>{d.subject} — </strong> : null}
              {d.body.trim() || t("draftEmpty")}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn-danger"
            title={t("delete") || "Delete"}
            aria-label={t("delete") || "Delete"}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(d);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: "50%",
              color: colors.textSecondary,
              display: "flex",
              flexShrink: 0,
            }}
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
