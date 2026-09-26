import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getImportantMessages, updateEmail } from "../api/client.js";
import { getAvatarInitials, getAvatarColor, formatPhoneNumber } from "../utils/contact.js";
import { Star, Users } from "lucide-react";

function formatRelativeDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ImportantList({ onSelect }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getImportantMessages();
      setItems(data || []);
    } catch (err) {
      console.error("[ImportantList] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStar = async (e, item) => {
    e.stopPropagation();
    try {
      await updateEmail(item.id, { is_favorite: 0 });
      // Optimistically remove from list
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error("[ImportantList] Error unstarring message:", err);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: colors.surface }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: `1px solid ${colors.border}`,
                gap: 12,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 22, background: colors.surfaceAlt, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 14, background: colors.surfaceAlt, borderRadius: 4, width: "35%" }} />
                <div style={{ height: 12, background: colors.surfaceAlt, borderRadius: 4, width: "65%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: colors.surface, overflow: "hidden" }}>
      {/* List / Empty State */}
      {items.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            textAlign: "center",
            gap: 12,
            color: colors.textSecondary,
          }}
        >
          <Star size={44} strokeWidth={1.5} color={colors.textSecondary} />
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>
            {t("noFavorites")}
          </div>
          <p style={{ margin: 0, fontSize: 14, maxWidth: 300, lineHeight: 1.4 }}>
            {t("noImportantMessagesDesc")}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {items.map((item) => {
            const displayName = item.is_group
              ? (item.counterpart_name || "Group")
              : (item.from_name || item.from_display || item.counterpart_name || formatPhoneNumber(item.from_address || item.counterpart || ""));

            const avatarKey = item.from_address || item.counterpart || "contact";
            const initials = getAvatarInitials(displayName);
            const avatarBg = getAvatarColor(avatarKey);
            const formattedDate = formatRelativeDate(item.created_at);
            const snippet = item.body_text || (item.body_html ? item.body_html.replace(/<[^>]+>/g, "") : item.subject || "");

            return (
              <div
                key={item.id}
                className="thread-row"
                onClick={() => onSelect(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.surface,
                  gap: 12,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: avatarBg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: colors.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "70%",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {item.is_group && <Users size={14} style={{ flexShrink: 0 }} />}
                      <span>{displayName}</span>
                    </span>
                    <span style={{ fontSize: 11, color: colors.textSecondary, flexShrink: 0 }}>
                      {formattedDate}
                    </span>
                  </div>

                  {/* Subject Badge & Snippet */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    {item.subject && item.subject !== "(no subject)" && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: colors.surfaceAlt,
                          border: `1px solid ${colors.border}`,
                          color: colors.textPrimary,
                          padding: "1px 6px",
                          borderRadius: 4,
                          flexShrink: 0,
                          maxWidth: 140,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.subject}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {snippet}
                    </span>
                  </div>
                </div>

                {/* Star icon button */}
                <button
                  type="button"
                  className="icon-btn"
                  title={t("unmarkImportant")}
                  onClick={(e) => handleToggleStar(e, item)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Star size={17} fill="#f59e0b" color="#f59e0b" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
