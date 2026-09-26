import React, { useState } from "react";
import { Inbox, Star, ShieldAlert, Trash2, X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { useI18n } from "../i18n/I18nContext.jsx";

const FOLDERS = [
  { id: "home",      labelKey: "folderHome",      Icon: Inbox },
  { id: "important", labelKey: "folderImportant", Icon: Star },
  { id: "spam",      labelKey: "folderSpam",      Icon: ShieldAlert },
  { id: "trash",     labelKey: "folderTrash",     Icon: Trash2 },
];

export default function Sidebar({ currentFolder, onSelectFolder, isOpen, onClose, importantCount = 0, trashCount = 0 }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isMobile = useIsMobile(768);

  return (
    <>
      {/* Click-outside dark overlay: visible & interactive only on mobile when sidebar is open */}
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: 998,
            cursor: "pointer",
            transition: "opacity 0.2s ease",
          }}
          className="sidebar-overlay"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        style={
          isMobile
            ? {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                height: "100vh",
                width: 260,
                maxWidth: "80vw",
                background: colors.surface,
                borderRight: `1px solid ${colors.border}`,
                display: "flex",
                flexDirection: "column",
                zIndex: 999,
                transform: isOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease",
                boxShadow: isOpen ? "4px 0 24px rgba(0, 0, 0, 0.18)" : "none",
                visibility: isOpen ? "visible" : "hidden",
                pointerEvents: isOpen ? "auto" : "none",
                overflowY: "auto",
              }
            : {
                width: isOpen ? 240 : 0,
                minWidth: isOpen ? 240 : 0,
                background: colors.surface,
                borderRight: isOpen ? `1px solid ${colors.border}` : "none",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                overflow: "hidden",
                transition:
                  "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                visibility: isOpen ? "visible" : "hidden",
                pointerEvents: isOpen ? "auto" : "none",
              }
        }
      >
        {/* Fixed-width inner container prevents text/buttons from squishing during width collapse animation */}
        <div style={{ width: 240, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header row */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              {t("folders")}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="icon-btn icon-btn-danger"
                style={{
                  background: "none",
                  border: "none",
                  color: colors.danger,
                  cursor: "pointer",
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Close folders"
                aria-label="Close folders"
              >
                <X size={16} strokeWidth={2} color={colors.danger} />
              </button>
            )}
          </div>

          <nav style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {FOLDERS.map((f) => {
              const isActive = currentFolder === f.id;
              const count = f.id === "important" ? importantCount : f.id === "trash" ? trashCount : null;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`sidebar-item${isActive ? " sidebar-item--active" : ""}`}
                  onClick={() => {
                    onSelectFolder(f.id);
                    if (isMobile && onClose) onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? colors.accentLight : "transparent",
                    color: isActive ? colors.textAccent : colors.textPrimary,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <f.Icon
                    size={17}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    color={isActive ? colors.accent : colors.textSecondary}
                  />
                  <span style={{ flex: 1 }}>{t(f.labelKey)}</span>
                  {typeof count === "number" && count > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: isActive ? colors.accentLight : colors.surfaceHover,
                        color: isActive ? colors.textAccent : colors.textPrimary,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
