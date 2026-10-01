import React, { useState, useRef, useEffect } from "react";
import { FileText, Trash2, X, Check } from "lucide-react";
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
export default function DraftsList({ drafts, onOpen, onDelete, onSelBar }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [selIds, setSelIds] = useState(() => new Set());
  const selMode = selIds.size > 0;
  const lpTimer = useRef(null);
  const lpDone = useRef(false);
  const startLP = (id) => { lpDone.current = false; clearTimeout(lpTimer.current); lpTimer.current = setTimeout(() => { lpDone.current = true; setSelIds(new Set([id])); }, 450); };
  const cancelLP = () => clearTimeout(lpTimer.current);
  const toggleSel = (id) => setSelIds((prev) => { const nx = new Set(prev); if (nx.has(id)) nx.delete(id); else nx.add(id); return nx; });
  const deleteSelected = () => { drafts.filter((x) => selIds.has(x.id)).forEach((x) => onDelete(x)); setSelIds(new Set()); };
  useEffect(() => {
    if (!onSelBar) return;
    if (selMode) onSelBar({ count: selIds.size, onCancel: () => setSelIds(new Set()), onAction: deleteSelected, label: t("selDeleteBtn"), icon: <Trash2 size={15} strokeWidth={2} /> });
    else onSelBar(null);
  }, [selIds]);
  useEffect(() => () => { if (onSelBar) onSelBar(null); }, []);

  if (!drafts.length) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: colors.textSecondary, fontSize: 14 }}>
        {t("noDrafts")}
      </div>
    );
  }

  return (
    <>
        <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 4, paddingBottom: 8 }}>
      {drafts.map((d) => (
        <div
          key={d.id}
          role="button"
          tabIndex={0}
          className="thread-row"
          onClick={() => { if (lpDone.current) { lpDone.current = false; return; } if (selMode) toggleSel(d.id); else onOpen(d); }}
          onMouseDown={() => startLP(d.id)} onMouseUp={cancelLP} onMouseLeave={cancelLP}
          onTouchStart={() => startLP(d.id)} onTouchEnd={cancelLP} onTouchMove={cancelLP} onTouchCancel={cancelLP}
          onKeyDown={(e) => (e.key === "Enter" ? onOpen(d) : null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 72, boxSizing: "border-box", padding: 12, margin: "0 8px", marginBottom: 4, borderRadius: "var(--r-md)", cursor: "pointer", position: "relative", background: selIds.has(d.id) ? "var(--primary-tint)" : "transparent", transform: selIds.has(d.id) ? "scale(1.02)" : "none", userSelect: "none",
          }}
        >
          <span style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, boxSizing: "border-box", display: selMode ? "flex" : "none", alignItems: "center", justifyContent: "center", border: selIds.has(d.id) ? "2px solid var(--primary)" : "2px solid var(--border-strong)", background: selIds.has(d.id) ? "var(--primary)" : "transparent", color: "var(--on-primary)" }}>{selIds.has(d.id) ? <Check size={12} strokeWidth={3} /> : null}</span>

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
    </>
  );
}
