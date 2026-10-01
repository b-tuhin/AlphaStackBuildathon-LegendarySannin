import React, { useEffect, useRef, useState } from "react";
import { Inbox, Star, FileText, ShieldAlert, Trash2 } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Logo from "./Logo.jsx";

const FOLDERS = [
  { id: "home",      labelKey: "folderHome",      Icon: Inbox },
  { id: "important", labelKey: "folderImportant", Icon: Star },
  { id: "drafts",    labelKey: "folderDrafts",    Icon: FileText },
  { id: "spam",      labelKey: "folderSpam",      Icon: ShieldAlert },
  { id: "trash",     labelKey: "folderTrash",     Icon: Trash2 },
];

const DRAWER_WIDTH = 260;
const OPEN_MS = 300;
const CLOSE_MS = 260;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export default function Sidebar({ currentFolder, onSelectFolder, isOpen, onClose, importantCount = 0, trashCount = 0, draftsCount = 0 }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isNarrow = useIsMobile(1023);
  const isMobile = isNarrow;


  const asideRef = useRef(null);

  // Live finger-follow while the drawer is dragged closed (mobile). null = not dragging.
  const [dragX, setDragX] = useState(null);
  const touchRef = useRef({ tracking: false, horizontal: null, x: 0, y: 0, time: 0 });

  // ── Tap / click anywhere outside the menu closes it (there is no ✕ button) ──
  // We listen for `click` (not pointerdown) so the tapped element still receives its
  // own click before the layout starts to move. The hamburger button opts out via
  // [data-sidebar-toggle] because it toggles the menu itself.
  useEffect(() => {
    if (!isOpen || !onClose) return undefined;
    const handleOutside = (e) => {
      if (asideRef.current && asideRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest("[data-sidebar-toggle]")) return;
      onClose();
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [isOpen, onClose]);

  // Esc closes as well
  useEffect(() => {
    if (!isOpen || !onClose) return undefined;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // ── Swipe right→left to close, following the finger ────────────────────────
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchRef.current = { tracking: true, horizontal: null, x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchMove = (e) => {
    const s = touchRef.current;
    if (!s.tracking) return;
    const touch = e.touches[0];
    const dx = touch.clientX - s.x;
    const dy = touch.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!s.horizontal) {
      s.tracking = false; // vertical scroll inside the menu — leave it alone
      return;
    }
    setDragX(Math.max(-DRAWER_WIDTH, Math.min(0, dx)));
  };

  const handleTouchEnd = (e) => {
    const s = touchRef.current;
    const wasDragging = s.tracking && s.horizontal === true;
    s.tracking = false;
    if (!wasDragging) { setDragX(null); return; }
    const dx = e.changedTouches[0].clientX - s.x;
    const velocity = dx / Math.max(1, Date.now() - s.time); // px per ms, negative = leftwards
    setDragX(null);
    if (dx < -70 || (velocity < -0.5 && dx < -20)) onClose && onClose();
  };

  const handleTouchCancel = () => {
    touchRef.current.tracking = false;
    setDragX(null);
  };

  const dragging = dragX !== null;
  const drawerPx = Math.min(DRAWER_WIDTH, typeof window !== "undefined" ? window.innerWidth * 0.8 : DRAWER_WIDTH);
  const dragProgress = dragging ? Math.max(0, 1 + dragX / drawerPx) : 1;

  const touchHandlers = isNarrow
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
      }
    : {};

  const asideStyle = isNarrow
    ? {
        position: "fixed",
        top: 8,
        bottom: 8,
        left: 8,
        width: "min(320px, 86vw)",
        maxWidth: "min(320px, 86vw)",
        borderRadius: "var(--r-xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1011,
        transform: dragging ? `translateX(${dragX}px)` : isOpen ? "translateX(0)" : "translateX(calc(-100% - 16px))",
        transition: dragging
          ? "none"
          : `transform ${isOpen ? OPEN_MS : CLOSE_MS}ms ${EASE}, box-shadow ${CLOSE_MS}ms ease, visibility 0s linear ${isOpen ? 0 : CLOSE_MS}ms`,
        boxShadow: isOpen ? "var(--shadow-sm)" : "none",
        visibility: isOpen ? "visible" : "hidden",
        pointerEvents: isOpen ? "auto" : "none",
        overflowY: "auto",
        touchAction: "pan-y",
      }
    : {
        width: isOpen ? 240 : 0,
        minWidth: isOpen ? 240 : 0,
        background: "transparent",
        borderRight: "none",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        transition: `width ${isOpen ? OPEN_MS : CLOSE_MS}ms ${EASE}, min-width ${isOpen ? OPEN_MS : CLOSE_MS}ms ${EASE}, visibility 0s linear ${isOpen ? 0 : CLOSE_MS}ms`,
        visibility: isOpen ? "visible" : "hidden",
        pointerEvents: isOpen ? "auto" : "none",
      };

  return (
    <>
      {/* Scrim (mobile). Always mounted so it can fade OUT as well as in. */}
      {isNarrow && (
        <div
          onClick={onClose}
          {...touchHandlers}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            zIndex: 1010,
            opacity: isOpen ? dragProgress : 0,
            transition: dragging ? "none" : `opacity ${isOpen ? OPEN_MS : CLOSE_MS}ms ease`,
            pointerEvents: isOpen ? "auto" : "none",
            touchAction: "pan-y",
          }}
        />
      )}

      <aside
        ref={asideRef}
        className="chat-scroll-container"
        aria-hidden={!isOpen}
        {...touchHandlers}
        style={asideStyle}
      >
        {/* Fixed-width inner container keeps content from squishing while the width collapses */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            ...(isNarrow
              ? {}
              : {
                  transform: isOpen ? "translateX(0)" : "translateX(-28px)",
                  opacity: isOpen ? 1 : 0,
                  transition: `transform ${isOpen ? OPEN_MS : CLOSE_MS}ms ${EASE}, opacity ${CLOSE_MS}ms ease`,
                }),
          }}
        >
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={56} />
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
          </div>

          <nav className="chat-scroll-container" style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
            {FOLDERS.map((f) => {
              const isActive = currentFolder === f.id;
              const count = f.id === "important" ? importantCount : f.id === "trash" ? trashCount : f.id === "drafts" ? draftsCount : null;
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
                    padding: "0 12px",
                    height: 44,
                    borderRadius: "var(--r-md)",
                    border: "none",
                    background: isActive ? "var(--primary-tint)" : "transparent",
                    color: isActive ? "var(--link)" : colors.textPrimary,
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
                    color={isActive ? "var(--link)" : colors.textSecondary}
                  />
                  <span style={{ flex: 1 }}>{t(f.labelKey)}</span>
                  {typeof count === "number" && count > 0 && (
                    <span
                      aria-label={f.id === "drafts" ? t("draftsCountAria").replace("{n}", count) : undefined}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 24,
                        height: 24,
                        boxSizing: "border-box",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "0 8px",
                        borderRadius: 999,
                        background: "var(--primary-tint)",
                        color: "var(--link)",
                      }}
                    >
                      {count > 99 ? "99+" : count}
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
