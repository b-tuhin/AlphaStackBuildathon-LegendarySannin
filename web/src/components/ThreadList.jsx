import React, { useState, useRef } from "react";
import { Paperclip, RotateCcw, Trash2, Users, Minus } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getSenderDisplayName, getAvatarInitials, getAvatarColor, formatPhoneNumber } from "../utils/contact.js";
import ThemedCheckbox from "./ThemedCheckbox.jsx";

export default function ThreadList({
  items,
  selectedId,
  onSelect,
  loading,
  folder,
  filter,
  onDelete,
  onRestore,
  onRetry,
  trashSelectionMode = false,
  selectedTrashIds = new Set(),
  onToggleSelectTrash,
  onEnterTrashSelection,
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (loading && (!items || items.length === 0)) {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: colors.surface }}>
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
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: colors.surface }}>
      {items.map((item) => {
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
          ? new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
          : "";

        const hasRealSub = Boolean(item.subject && typeof item.subject === "string" && item.subject.trim() && item.subject.trim() !== "(no subject)");
        const snippet = isThread
          ? (item.last_message || (hasRealSub ? item.subject : "") || "No messages yet")
          : (item.body_text || (hasRealSub ? item.subject : "") || "(no message text)");

        const hasAttachments = Boolean(item.has_attachments);

        return (
          <ThreadRow
            key={id}
            item={item}
            isThread={isThread}
            isSelected={isSelected}
            isUnread={isUnread}
            displayName={displayName}
            initials={initials}
            avatarBg={avatarBg}
            formattedDate={formattedDate}
            snippet={snippet}
            hasAttachments={hasAttachments}
            colors={colors}
            folder={folder}
            onSelect={onSelect}
            onDelete={onDelete}
            onRestore={onRestore}
            trashSelectionMode={trashSelectionMode}
            isTrashSelected={selectedTrashIds?.has(item.id)}
            onToggleSelectTrash={onToggleSelectTrash}
            onEnterTrashSelection={onEnterTrashSelection}
          />
        );
      })}
    </div>
  );
}

/** Separate row component so hover state is isolated per-row */
function ThreadRow({
  item, isThread, isSelected, isUnread, displayName, initials, avatarBg,
  formattedDate, snippet, hasAttachments, colors, folder, onSelect, onDelete, onRestore,
  trashSelectionMode, isTrashSelected, onToggleSelectTrash, onEnterTrashSelection,
}) {
  const [hovered, setHovered] = useState(false);
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef(null);
  const didLongPressRef = useRef(false);

  const isTrash = folder === "trash";

  const handleTouchStart = (e) => {
    if (!isTrash) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    didLongPressRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      if (onEnterTrashSelection) onEnterTrashSelection(item.id);
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (!isTrash || !touchStartPosRef.current) return;
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
    if (!isTrash || e.button !== 0) return;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (onEnterTrashSelection) onEnterTrashSelection(item.id);
    }, 450);
  };

  const handleMouseMove = (e) => {
    if (!isTrash || !touchStartPosRef.current) return;
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
    if (isTrash && trashSelectionMode) {
      if (onToggleSelectTrash) onToggleSelectTrash(item.id);
      return;
    }
    onSelect(item);
  };

  const bgColor = isTrash && trashSelectionMode && isTrashSelected
    ? colors.accentLight
    : isSelected
    ? colors.surfaceHover
    : hovered
    ? colors.surfaceHover
    : colors.surface;

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
        padding: "12px 16px",
        cursor: "pointer",
        borderBottom: `1px solid ${colors.border}`,
        background: bgColor,
        gap: 12,
        position: "relative",
      }}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(e); }}
      aria-pressed={isSelected}
    >
      {/* Trash multi-select checkbox */}
      {isTrash && trashSelectionMode && (
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

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Row 1: Name and Date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontWeight: isUnread ? 700 : 500,
              fontSize: 14,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "70%",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {isThread && item.is_group && (
              <Users size={13} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} />
            )}
            {displayName}
          </span>
          <span style={{ fontSize: 11, color: colors.textSecondary, flexShrink: 0 }}>
            {formattedDate}
          </span>
        </div>

        {/* Row 2: Subject & Message Preview */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              color: isUnread ? colors.textPrimary : colors.textSecondary,
              fontWeight: isUnread ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {hasAttachments && (
              <Paperclip size={12} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} title="Has attachment" />
            )}
            {isThread && !item.is_group ? (
              (item.subject && typeof item.subject === "string" && item.subject.trim() && item.subject.trim() !== "(no subject)") ? (
                <><strong style={{ color: colors.textPrimary, marginRight: 4 }}>{item.subject} —</strong>{snippet}</>
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
                    title="No subject"
                  >
                    <Minus size={12} strokeWidth={2.5} />
                  </span>
                  <span style={{ color: colors.textSecondary, marginRight: 4 }}>—</span>
                  {snippet}
                </>
              )
            ) : snippet}
          </span>

          {/* Badge or Restore/Delete actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {isThread && item.unread_count > 0 && (
              <span
                style={{
                  background: colors.accent,
                  color: "#fff",
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
                title="Restore to Inbox"
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

            {onDelete && (
              <button
                type="button"
                title="Move to trash"
                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                className="icon-btn icon-btn-danger"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "3px 4px",
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  opacity: 0.7,
                }}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
