import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Paperclip,
  RotateCcw,
  Trash2,
  Users,
  Minus,
  MoreVertical,
  Star,
  MailOpen,
  Mail,
  Archive,
  Pin,
} from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getSenderDisplayName, getAvatarInitials, getAvatarColor, formatPhoneNumber } from "../utils/contact.js";
import Avatar from "./Avatar.jsx";
import ThemedCheckbox from "./ThemedCheckbox.jsx";
import { highlightText } from "../utils/textHighlight.jsx";
import { parseServerDate } from "../utils/dateFix.js";


export default function ThreadList({
  items,
  selectedId,
  onSelect,
  loading,
  folder,
  filter,
  onDelete,
  onRestore,
  onToggleRead,
  onToggleImportant,
  onArchive,
  onTogglePin,
  onRetry,
  trashSelectionMode = false,
  selectedTrashIds = new Set(),
  onToggleSelectTrash,
  onEnterTrashSelection,
  query = "",
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const sortedItems = React.useMemo(() => {
    if (!items || !items.length) return [];
    return [...items].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned; // pinned first
      }
      if (aPinned === 1) {
        const nameA = String(a.counterpart_name || a.counterpart || a.from_name || a.from_address || "").toLowerCase();
        const nameB = String(b.counterpart_name || b.counterpart || b.from_name || b.from_address || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const dateA = parseServerDate(a.last_message_at || a.created_at || 0).getTime();
      const dateB = parseServerDate(b.last_message_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [items]);

  if (loading && (!items || items.length === 0)) {
    return (
      <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto", background: colors.surface }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
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
    );
  }

  if (!items || items.length === 0) {
    let emptyMsg = t("noMessages", folder);
    if (folder === "home") {
      emptyMsg = filter === "favorites" ? t("noFavorites") : t("noConversations");
    }

    return (
      <div style={{ flex: 1, padding: 40, textAlign: "center", color: colors.textSecondary, background: colors.surface }}>
        {emptyMsg}
      </div>
    );
  }

  return (
    <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "transparent", paddingTop: 4, paddingBottom: 8 }}>
      {sortedItems.map((item) => {
        const isThread = folder === "home" || folder === "trash" || folder === "spam" || Boolean(item.participant_a || item.participants || item.counterpart);
        const id = item.id;
        const isSelected = selectedId === id;
        const isUnread = isThread ? (item.unread_count > 0) : !item.is_read;

        // Display name & avatar resolution
        const rawDisplayName = isThread
          ? (item.is_group
              ? (item.group_name || item.counterpart || "Group")
              : (item.counterpart_name || formatPhoneNumber(item.counterpart || "")))
          : (item.from_name || item.from_display || formatPhoneNumber(item.from_address || item.to_address || ""));

        const displayName = (rawDisplayName && String(rawDisplayName).trim()) || "Unknown sender";

        const avatarKey = isThread
          ? (item.counterpart || item.group_name || displayName)
          : (item.from_address || item.to_address || displayName);

        const initials = getAvatarInitials(displayName, isThread ? item.is_group : false);
        const avatarBg = getAvatarColor(avatarKey);

        const dateStr = item.last_message_at || item.created_at;
        const formattedDate = dateStr
          ? parseServerDate(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
          : "";

        const hasRealSub = Boolean(item.subject && typeof item.subject === "string" && item.subject.trim() && item.subject.trim() !== "(no subject)" && !/^[\-\u2013\u2014\s]+$/.test(item.subject));
        const snippet = isThread
          ? (item.last_message || (hasRealSub ? item.subject : "") || "No messages yet")
          : (item.body_text || (hasRealSub ? item.subject : "") || "(no message text)");

        const hasAttachments = Boolean(item.last_has_attachments ?? item.has_attachments);

        return (
          <SlideRow
            key={id}
            item={item}
            isThread={isThread}
            isSelected={isSelected}
            isUnread={isUnread}
            displayName={displayName}
            initials={initials}
            avatarBg={avatarBg}
            avatarSrc={isThread ? item.avatar_url : item.from_avatar_url}
            avatarKey={avatarKey}
            formattedDate={formattedDate}
            snippet={snippet}
            hasAttachments={hasAttachments}
            colors={colors}
            folder={folder}
            onSelect={onSelect}
            onDelete={onDelete}
            onRestore={onRestore}
            onToggleRead={onToggleRead}
            onToggleImportant={onToggleImportant}
            onArchive={onArchive}
            onTogglePin={onTogglePin}
            trashSelectionMode={trashSelectionMode}
            isTrashSelected={selectedTrashIds?.has(item.id)}
            onToggleSelectTrash={onToggleSelectTrash}
            onEnterTrashSelection={onEnterTrashSelection}
            query={query}
          />
        );
      })}
    </div>
  );
}

/** Separate row component so hover state is isolated per-row */
function ThreadRow({
  item, isThread, isSelected, isUnread, displayName, initials, avatarBg, avatarSrc, avatarKey,
  formattedDate, snippet, hasAttachments, colors, folder, onSelect, onDelete, onRestore,
  onToggleRead, onToggleImportant, onArchive, onTogglePin,
  trashSelectionMode, isTrashSelected, onToggleSelectTrash, onEnterTrashSelection,
  query = "",
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef(null);
  const didLongPressRef = useRef(false);

  const isTrash = folder === "trash"; const isSel = folder === "trash" || folder === "spam";
  const isImportant = Boolean(item.is_favorite);

  // Compute menu coordinates synchronously before paint to prevent positioning flash
  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      setMenuCoords(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 180;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    let top = rect.bottom + 4;
    const estimatedHeight = 160;
    if (top + estimatedHeight > window.innerHeight && rect.top > estimatedHeight) {
      top = rect.top - estimatedHeight - 4;
    }
    setMenuCoords({
      top: Math.round(top),
      left: Math.round(left),
    });
  }, [menuOpen]);

  // Close menu on click outside, Escape, or scroll
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpen]);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    didLongPressRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      if (isSel) {
        if (onEnterTrashSelection) onEnterTrashSelection(item.id);
      } else {
        setMenuOpen(true);
      }
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y);
    if (dist > 8) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);
    touchStartPosRef.current = null;
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (isSel) {
        if (onEnterTrashSelection) onEnterTrashSelection(item.id);
      }
    }, 450);
  };

  const handleMouseMove = (e) => {
    if (!touchStartPosRef.current) return;
    const dist = Math.hypot(e.clientX - touchStartPosRef.current.x, e.clientY - touchStartPosRef.current.y);
    if (dist > 8) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleMouseUp = () => {
    clearTimeout(longPressTimerRef.current);
    touchStartPosRef.current = null;
  };

  const handleClick = (e) => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (isSel && trashSelectionMode) {
      if (onToggleSelectTrash) onToggleSelectTrash(item.id);
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    onSelect(item);
  };

  const bgColor = isSel && trashSelectionMode && isTrashSelected
    ? "var(--primary-tint)"
    : isSelected
    ? "var(--primary-tint)"
    : hovered
    ? "var(--hover)"
    : "transparent";

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`thread-row${isSelected ? " thread-row--selected" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 72,
        boxSizing: "border-box",
        padding: 12,
        margin: "0 8px",
        marginBottom: 4,
        cursor: "pointer",
        background: bgColor,
        borderRadius: "var(--r-md)",
        gap: 12,
        position: "relative",
      }}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(e); }}
      aria-pressed={isSelected}
    >

      {/* Trash multi-select checkbox */}
      {isSel && trashSelectionMode && (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <ThemedCheckbox
            checked={Boolean(isTrashSelected)}
            onChange={() => onToggleSelectTrash?.(item.id)}
            size={18}
            ariaLabel={`Select thread from ${displayName}`}
          />
        </div>
      )}

      {/* Sender / Group Avatar */}
      <Avatar src={avatarSrc} name={displayName} colorKey={avatarKey} isGroup={Boolean(isThread && item.is_group)} size={48} fontSize={18} />

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Row 1: Name, Star, and Date on one baseline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", minWidth: 0, gap: 8 }}>
          <span
            style={{
              fontWeight: isUnread ? 700 : 600,
              fontSize: 16,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isThread && item.is_group && (
              <Users size={15} strokeWidth={1.75} color={colors.textSecondary} style={{ flexShrink: 0 }} />
            )}
            {displayName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {Boolean(item.pinned) && (
              <Pin size={12} fill={colors.accent} color={colors.accent} style={{ flexShrink: 0, transform: "rotate(45deg)" }} title={t("pinned") || "Pinned"} />
            )}
            {isImportant && (
              null
            )}
            <span style={{ fontSize: 12, color: colors.textSecondary }}>
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Row 2: Subject & Message Preview (4px below name) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              fontWeight: isUnread ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {hasAttachments && (
              <Paperclip size={12} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} title={t("tlAttach")} />
            )}
            {isThread && !item.is_group ? (
              (item.subject && typeof item.subject === "string" && item.subject.trim() && item.subject.trim() !== "(no subject)" && !/^[\-\u2013\u2014\s]+$/.test(item.subject)) ? (
                <><strong style={{ color: colors.textPrimary, marginRight: 4 }}>{item.subject}:</strong>{query ? highlightText(snippet, query) : snippet}</>
              ) : (
                <>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      color: colors.textSecondary,
                      marginRight: 4,
                      opacity: 0.6,
                    }}
                    title={t("tlNoSubject")}
                  >
                  </span>
                  {query ? highlightText(snippet, query) : snippet}
                </>
              )
            ) : (query ? highlightText(snippet, query) : snippet)}
          </span>

          {/* Badge, Actions, and Overflow Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, position: "relative" }}>
            {isThread && item.unread_count > 0 && (
              <span
                style={{
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  padding: "0 6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.unread_count}
              </span>
            )}

            {folder !== "home" && onRestore && (
              <button
                type="button"
                title={t("tlRestore")}
                onClick={(e) => { e.stopPropagation(); onRestore(item); }}
                className="icon-btn"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "3px 4px",
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <RotateCcw size={14} strokeWidth={2} />
              </button>
            )}

            {/* Hover-reveal ⋮ button */}
            <button
              ref={triggerRef}
              type="button"
              data-ui-exempt="true"
              title={t("moreActions")}
              aria-label="More actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="icon-btn"
              style={{
                border: "none",
                background: menuOpen ? colors.surfaceHover : "none",
                cursor: "pointer",
                padding: "3px 4px",
                borderRadius: 4,
                color: colors.textSecondary,
                display: "flex",
                alignItems: "center",
                opacity: (hovered || menuOpen) ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            >
              <MoreVertical size={15} strokeWidth={2} />
            </button>

            {/* Dropdown Menu via Portal to prevent layout jump and overflow clipping */}
            {menuOpen && typeof document !== "undefined" && createPortal(
              <div
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: menuCoords ? menuCoords.top : -9999,
                  left: menuCoords ? menuCoords.left : -9999,
                  opacity: menuCoords ? 1 : 0,
                  visibility: menuCoords ? "visible" : "hidden",
                  minWidth: 175,
                  background: colors.surfaceCard || colors.surfaceAlt || colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  boxShadow: "var(--shadow-sm)",
                  zIndex: 99999,
                  padding: "4px 0",
                  display: "flex",
                  flexDirection: "column",
                  transition: "opacity 0.08s ease",
                }}
              >
                {/* Pin / Unpin */}
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onTogglePin(item);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Pin size={15} color={Boolean(item.pinned) ? colors.accent : colors.textSecondary} fill={Boolean(item.pinned) ? colors.accent : "none"} style={{ transform: "rotate(45deg)" }} />
                    <span>{Boolean(item.pinned) ? (t("unpin") || "Unpin") : (t("pin") || "Pin")}</span>
                  </button>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: colors.border, margin: "4px 0" }} />

                {/* 4. Trash / Delete permanently */}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(item);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: colors.danger,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Trash2 size={15} color={colors.danger} />
                    <span>{folder === "trash" ? (t("deletePermanently") || "Delete permanently") : (t("moveToTrash") || "Move to trash")}</span>
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Glides a row from its old position to its new one when the list reorders */
function SlideRow(props) {
  const ref = useRef(null);
  const prevTop = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.offsetTop;
    const prev = prevTop.current;
    prevTop.current = top;
    if (prev === null || prev === top) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const up = prev > top; el.style.position = "relative"; el.style.zIndex = up ? "3" : "1"; if (up) el.style.background = "var(--surface)"; setTimeout(() => { el.style.zIndex = ""; el.style.background = ""; }, 470); el.animate(
      [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
      { duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );
  });
  return <div ref={ref} style={{ willChange: "transform" }}><ThreadRow {...props} /></div>;
}
