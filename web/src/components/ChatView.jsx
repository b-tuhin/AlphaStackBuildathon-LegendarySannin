import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  FileEdit,
  Trash2,
  Paperclip,
  Mic,
  MicOff,
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  Download,
  Reply,
  Star,
  Users,
  MailOpen,
  X,
  Check,
  CheckCheck,
  Minus,
  MoreVertical,
  Copy,
  Pencil,
  Eye,
  Search,
  ChevronUp,
  ChevronDown,
  Globe,
} from "lucide-react";
import {
  getThreadMessages,
  uploadAttachment,
  assistDraft,
  downloadAttachment,
  updateEmail,
  BASE_URL,
} from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import {
  formatPhoneNumber,
  getSenderDisplayName,
  getAvatarInitials,
  getAvatarColor,
} from "../utils/contact.js";
import { useIsMobile } from "../utils/useIsMobile.js";
import {
  VOICE_LANGUAGES,
  getSavedSpeechLang,
  saveSpeechLang,
  getSavedReadAloudLang,
  saveReadAloudLang,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  speakText,
  stopSpeaking,
  isSpeechSynthesisSupported,
} from "../utils/speech.js";
import ThemedCheckbox from "./ThemedCheckbox.jsx";
import VoiceLanguageMenu from "./VoiceLanguageMenu.jsx";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ASSIST_INTENT_CHIPS = [
  { id: "question",    label: "Ask question",     intent: "Ask a polite question and request clarification" },
  { id: "request",     label: "Make request",     intent: "Make a polite, formal request for assistance" },
  { id: "followup",    label: "Follow up",         intent: "Follow up politely on the status of my previous message" },
  { id: "appointment", label: "Book a slot",       intent: "Inquire about available slots to book an appointment" },
];

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function MessageBubbleItem({
  msg,
  index,
  isOwn,
  isGroup,
  me,
  colors,
  isMobile,
  highlightedMsgId,
  referencedMsg,
  activeMenuMsgId,
  setActiveMenuMsgId,
  deletingMsgId,
  setDeletingMsgId,
  editingMsgId,
  setEditingMsgId,
  editingText,
  setEditingText,
  copiedMsgId,
  speakingMsgId,
  onReply,
  onReplyPrivately,
  onToggleFavorite,
  onSpeak,
  onCopy,
  onSaveEdit,
  onDelete,
  onOpenFormal,
  onJumpToMessage,
  onPreviewAttachment,
  downloadAttachment,
  formatBytes,
  t,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEnterSelection,
  readAloudLang,
  onSelectReadAloudLang,
  readAloudMenuMsgId,
  setReadAloudMenuMsgId,
  voiceWarning,
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef(null);
  const touchActiveRef = useRef(false);
  const mouseStartPosRef = useRef(null);
  const isSwipingRef = useRef(false);
  const isScrollingRef = useRef(false);
  const didLongPressRef = useRef(false);
  const snapTimerRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuDirection, setMenuDirection] = useState("down");
  const [menuPosition, setMenuPosition] = useState(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  const computePosition = useCallback((directionOverride) => {
    if (typeof window === "undefined" || !triggerBtnRef.current) return null;
    const btnRect = triggerBtnRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || 180;
    const menuHeight = menuEl?.offsetHeight || (deletingMsgId === msg.id ? 85 : 240);

    const dir = directionOverride || menuDirection || "down";

    // Horizontal positioning: align right edge with button right edge, clamped to viewport
    let left = btnRect.right - menuWidth;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - 8);
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Vertical positioning:
    const MARGIN = 6;
    let top;
    let maxHeight = "calc(100vh - 20px)";

    if (dir === "up") {
      top = btnRect.top - menuHeight - MARGIN;
      if (top < 8) {
        top = 8;
        maxHeight = `${Math.max(100, btnRect.top - MARGIN - 8)}px`;
      }
    } else {
      top = btnRect.bottom + MARGIN;
      if (top + menuHeight > window.innerHeight - 8) {
        maxHeight = `${Math.max(100, window.innerHeight - 8 - top)}px`;
      }
    }

    return { top, left, maxHeight };
  }, [deletingMsgId, msg.id, menuDirection]);

  useLayoutEffect(() => {
    if (activeMenuMsgId === msg.id) {
      setMenuPosition(computePosition(menuDirection));
    } else {
      setMenuPosition(null);
    }
  }, [activeMenuMsgId, deletingMsgId, menuDirection, computePosition, msg.id]);

  useEffect(() => {
    if (activeMenuMsgId !== msg.id) return;

    let rafId = null;
    const handleScrollOrResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!triggerBtnRef.current) {
          setActiveMenuMsgId(null);
          setDeletingMsgId(null);
          return;
        }

        const btnRect = triggerBtnRef.current.getBoundingClientRect();
        const scrollContainer = triggerBtnRef.current.closest(".chat-scroll-container");

        if (scrollContainer) {
          const scRect = scrollContainer.getBoundingClientRect();
          // If trigger button scrolled completely out of visible container or viewport
          if (
            btnRect.bottom < scRect.top ||
            btnRect.top > scRect.bottom ||
            btnRect.bottom < 0 ||
            btnRect.top > window.innerHeight
          ) {
            setActiveMenuMsgId(null);
            setDeletingMsgId(null);
            return;
          }
        } else {
          if (btnRect.bottom < 0 || btnRect.top > window.innerHeight) {
            setActiveMenuMsgId(null);
            setDeletingMsgId(null);
            return;
          }
        }

        setMenuPosition(computePosition());
      });
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveMenuMsgId(null);
        setDeletingMsgId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuMsgId, msg.id, computePosition, setActiveMenuMsgId, setDeletingMsgId]);

  useEffect(() => {
    return () => {
      clearTimeout(longPressTimerRef.current);
      clearTimeout(snapTimerRef.current);
    };
  }, []);

  const msgSenderName = isOwn
    ? (isGroup ? (msg.to_display ? `To: ${msg.to_display}` : "To: Group") : (me?.display_name || "You"))
    : (msg.from_name || msg.from_display || formatPhoneNumber(msg.from_address || ""));

  const msgInitials = isOwn
    ? getAvatarInitials(me?.display_name || "You")
    : getAvatarInitials(msgSenderName);
  const msgAvatarBg = getAvatarColor(msg.from_address);

  const timeStr = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const msgAttachments = Array.isArray(msg.attachments)
    ? msg.attachments
    : (() => { try { return JSON.parse(msg.attachments || "[]"); } catch { return []; } })();

  const isHighlighted = highlightedMsgId === msg.id;

  // ── Touch Handlers for Long-Press & Slide-to-Reply ────────────────────────
  const handleTouchStart = (e) => {
    if (e.target.closest("button, a, input, textarea, select, .msg-actions-menu, .msg-actions-trigger")) {
      return;
    }
    if (editingMsgId === msg.id) return;
    if (e.touches.length > 1) {
      clearTimeout(longPressTimerRef.current);
      return;
    }

    touchActiveRef.current = true;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isSwipingRef.current = false;
    isScrollingRef.current = false;
    didLongPressRef.current = false;
    setIsSnapping(false);

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      if (onEnterSelection) {
        onEnterSelection(msg.id);
      }
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    // Cancel long-press if movement exceeds 8px jitter tolerance
    if (dist > 8) {
      clearTimeout(longPressTimerRef.current);
    }

    // Suppress swipe-to-reply when multi-select mode is active
    if (selectionMode) return;

    if (!isSwipingRef.current && !isScrollingRef.current) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        isScrollingRef.current = true;
        return;
      } else if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe toward center
        if ((!isOwn && dx > 0) || (isOwn && dx < 0)) {
          isSwipingRef.current = true;
        } else {
          isScrollingRef.current = true;
          return;
        }
      }
    }

    if (isSwipingRef.current) {
      if (e.cancelable) e.preventDefault();
      let offset = 0;
      if (!isOwn) {
        // Dragging right
        if (dx <= 50) {
          offset = Math.max(0, dx);
        } else {
          offset = 50 + (dx - 50) * 0.35;
        }
        offset = Math.min(75, Math.max(0, offset));
      } else {
        // Dragging left
        if (dx >= -50) {
          offset = Math.min(0, dx);
        } else {
          offset = -50 + (dx + 50) * 0.35;
        }
        offset = Math.max(-75, Math.min(0, offset));
      }
      setSwipeOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);

    if (isSwipingRef.current) {
      const thresholdReached = Math.abs(swipeOffset) >= 48;
      if (thresholdReached) {
        if (navigator.vibrate) {
          try { navigator.vibrate(25); } catch {}
        }
        onReply(msg);
      }
      setIsSnapping(true);
      setSwipeOffset(0);
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => setIsSnapping(false), 240);
    } else if (!didLongPressRef.current) {
      const now = Date.now();
      const lastTap = lastTapRef.current;
      if (!selectionMode && lastTap && (now - lastTap.time < 300)) {
        const dx = Math.abs((touchStartPosRef.current?.x || 0) - lastTap.x);
        const dy = Math.abs((touchStartPosRef.current?.y || 0) - lastTap.y);
        if (dx < 25 && dy < 25) {
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          onOpenFormal(msg);
          touchStartPosRef.current = null;
          isSwipingRef.current = false;
          isScrollingRef.current = false;
          setTimeout(() => { touchActiveRef.current = false; }, 300);
          return;
        }
      }
      lastTapRef.current = {
        time: now,
        x: touchStartPosRef.current?.x || 0,
        y: touchStartPosRef.current?.y || 0,
      };
    }

    touchStartPosRef.current = null;
    isSwipingRef.current = false;
    isScrollingRef.current = false;
    setTimeout(() => {
      touchActiveRef.current = false;
    }, 300);
  };

  const handleTouchCancel = () => {
    clearTimeout(longPressTimerRef.current);
    if (isSwipingRef.current) {
      setIsSnapping(true);
      setSwipeOffset(0);
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => setIsSnapping(false), 240);
    }
    touchStartPosRef.current = null;
    isSwipingRef.current = false;
    isScrollingRef.current = false;
    touchActiveRef.current = false;
  };

  // ── Desktop Mouse Handlers for Long-Press ─────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (touchActiveRef.current) return;
    if (e.target.closest("button, a, input, textarea, select, .msg-actions-menu, .msg-actions-trigger")) {
      return;
    }
    if (editingMsgId === msg.id) return;

    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (onEnterSelection) {
        onEnterSelection(msg.id);
      }
    }, 450);
  };

  const handleMouseMove = (e) => {
    if (!mouseStartPosRef.current) return;
    const dist = Math.hypot(e.clientX - mouseStartPosRef.current.x, e.clientY - mouseStartPosRef.current.y);
    if (dist > 8) {
      clearTimeout(longPressTimerRef.current);
      mouseStartPosRef.current = null;
    }
  };

  const handleMouseUp = () => {
    clearTimeout(longPressTimerRef.current);
    mouseStartPosRef.current = null;
  };

  const handleMouseLeave = () => {
    clearTimeout(longPressTimerRef.current);
    mouseStartPosRef.current = null;
  };

  const handleBubbleClick = (e) => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (selectionMode) {
      e.stopPropagation();
      if (onToggleSelect) onToggleSelect(msg.id);
    }
  };

  const handleToggleMenu = (e) => {
    e.stopPropagation();
    if (activeMenuMsgId === msg.id) {
      setActiveMenuMsgId(null);
      setDeletingMsgId(null);
      return;
    }

    const btn = triggerBtnRef.current || e.currentTarget;
    const scrollContainer = btn?.closest(".chat-scroll-container");
    const menuEl = menuRef.current;
    const MENU_HEIGHT = menuEl?.offsetHeight || 240;
    const MARGIN = 12;

    let dir = "down";
    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();

        const spaceBelowViewport = containerRect.bottom - btnRect.bottom;
        const remainingScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop;

        if (spaceBelowViewport >= MENU_HEIGHT + MARGIN) {
          dir = "down";
        } else if (spaceBelowViewport + remainingScroll >= MENU_HEIGHT + MARGIN) {
          dir = "down";
          const neededScroll = (MENU_HEIGHT + MARGIN) - spaceBelowViewport;
          scrollContainer.scrollBy({ top: neededScroll + 10, behavior: "smooth" });
        } else {
          dir = "up";
        }
      } else {
        const spaceBelowViewport = window.innerHeight - btnRect.bottom;
        if (spaceBelowViewport < MENU_HEIGHT + MARGIN && btnRect.top >= MENU_HEIGHT + MARGIN) {
          dir = "up";
        } else {
          dir = "down";
        }
      }
    }

    setMenuDirection(dir);
    setActiveMenuMsgId(msg.id);
    setDeletingMsgId(null);
  };

  // Swipe metrics for reply icon indicator
  const swipeDist = Math.abs(swipeOffset);
  const swipeProgress = Math.min(1, Math.max(0, swipeDist / 48));
  const reachedThreshold = swipeDist >= 48;

  return (
    <div
      id={`msg-${msg.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOwn ? "flex-end" : "flex-start",
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: isMobile ? "85%" : "68%",
          minWidth: 160,
          width: "fit-content",
        }}
      >
        {/* Reply Indicator Circle for slide-to-reply */}
        {(swipeOffset !== 0 || isSnapping) && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              [isOwn ? "right" : "left"]: -38,
              transform: `translateY(-50%) scale(${0.5 + swipeProgress * 0.5})`,
              opacity: swipeProgress,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: reachedThreshold ? colors.accent : colors.surfaceAlt,
              color: reachedThreshold ? "#fff" : colors.textSecondary,
              border: `1px solid ${reachedThreshold ? colors.accent : colors.borderStrong}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              pointerEvents: "none",
              zIndex: 5,
              transition: isSnapping
                ? "opacity 0.22s ease, transform 0.22s ease"
                : "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
            }}
          >
            <Reply size={15} strokeWidth={2.5} />
          </div>
        )}

        {/* Bubble card */}
        <div
          onClick={handleBubbleClick}
          onDoubleClick={(e) => {
            if (!selectionMode) {
              e.stopPropagation();
              onOpenFormal(msg);
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isSnapping
              ? "transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              : (swipeOffset !== 0 ? "none" : "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease"),
            touchAction: "pan-y",
            userSelect: "text",
            cursor: selectionMode ? "pointer" : "default",
            background: isSelected
              ? colors.accentLight
              : isHighlighted
              ? (colors.highlightBg || (isOwn ? "#dcfce7" : "#fef9c3"))
              : msg.is_favorite
              ? colors.favoriteBubbleBg
              : (isOwn ? colors.bubbleOut : colors.bubbleIn),
            border: isSelected
              ? `2px solid ${colors.accent}`
              : isHighlighted
              ? `2px solid ${colors.highlightBorder || colors.accent}`
              : msg.is_favorite
              ? `1px solid ${colors.favoriteBubbleBorder}`
              : `1px solid ${isOwn ? colors.bubbleBorderOut : colors.bubbleBorderIn}`,
            borderRadius: 14,
            padding: "10px 14px",
            boxShadow: isSelected
              ? `0 0 0 3px ${colors.accentLight}, 0 4px 12px rgba(0,0,0,0.12)`
              : isHighlighted
              ? (colors.highlightGlow || `0 0 0 4px ${colors.accentLight || "rgba(37,99,235,0.25)"}, 0 4px 12px rgba(0,0,0,0.15)`)
              : msg.is_favorite
              ? colors.favoriteBubbleGlow
              : "0 1px 4px rgba(0,0,0,0.05)",
            position: "relative",
            color: colors.textPrimary,
          }}
        >
          {/* Bubble Header: Sender Avatar & Name + More Actions Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, position: "relative" }}>
            {selectionMode && (
              <ThemedCheckbox
                checked={Boolean(isSelected)}
                onChange={() => onToggleSelect && onToggleSelect(msg.id)}
                size={16}
                style={{ marginRight: 2 }}
                ariaLabel="Select message"
              />
            )}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: msgAvatarBg,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {msgInitials}
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: isOwn ? colors.accent : colors.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msgSenderName}
            </span>

            {/* More actions trigger button (hidden in multi-select mode) */}
            {!selectionMode && (
              <button
                ref={triggerBtnRef}
                type="button"
                className="icon-btn msg-actions-trigger"
                onClick={handleToggleMenu}
                style={{
                  background: activeMenuMsgId === msg.id ? colors.surfaceHover : "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: 4,
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical size={14} strokeWidth={2} />
              </button>
            )}

            {/* Popover / Dropdown Menu (Vertical WhatsApp-style) via Portal */}
            {!selectionMode && activeMenuMsgId === msg.id && typeof document !== "undefined" && createPortal(
              <div
                ref={menuRef}
                className="msg-actions-menu"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: (menuPosition || computePosition(menuDirection))?.top ?? 0,
                  left: (menuPosition || computePosition(menuDirection))?.left ?? 0,
                  maxHeight: (menuPosition || computePosition(menuDirection))?.maxHeight ?? "calc(100vh - 20px)",
                  overflowY: "auto",
                  background: colors.surface,
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  minWidth: 170,
                  zIndex: 2500,
                }}
              >
                {deletingMsgId === msg.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 8px" }}>
                    <span style={{ fontSize: 13, color: colors.danger, fontWeight: 600 }}>
                      Delete message?
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => {
                          onDelete(msg);
                          setActiveMenuMsgId(null);
                          setDeletingMsgId(null);
                        }}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          background: colors.dangerBg,
                          color: colors.danger,
                          border: `1px solid ${colors.danger}`,
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        title="Confirm delete"
                        aria-label="Confirm delete"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => setDeletingMsgId(null)}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          background: colors.surfaceAlt,
                          color: colors.danger,
                          border: `1px solid ${colors.borderStrong}`,
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X size={13} strokeWidth={2} color={colors.danger} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Reply */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        onReply(msg);
                        setActiveMenuMsgId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        width: "100%",
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "left",
                        borderRadius: 6,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: colors.textPrimary,
                      }}
                      title={t("replyDirectly") || "Reply"}
                      aria-label={t("replyDirectly") || "Reply"}
                    >
                      <Reply size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span>{t("replyDirectly") || "Reply"}</span>
                    </button>

                    {/* Reply Privately (group chats from others) */}
                    {isGroup && !isOwn && onReplyPrivately && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          onReplyPrivately(msg);
                          setActiveMenuMsgId(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          width: "100%",
                          fontSize: 13,
                          fontWeight: 500,
                          textAlign: "left",
                          borderRadius: 6,
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: colors.textPrimary,
                        }}
                        title={t("replyPrivate") || "Reply privately in 1:1 chat"}
                        aria-label={t("replyPrivate") || "Reply privately in 1:1 chat"}
                      >
                        <Reply size={15} strokeWidth={2} style={{ transform: "scaleX(-1)", flexShrink: 0 }} />
                        <span>{t("replyPrivate") || "Reply privately"}</span>
                      </button>
                    )}

                    {/* Star / Unstar */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        onToggleFavorite(msg);
                        setActiveMenuMsgId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        width: "100%",
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "left",
                        borderRadius: 6,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: colors.textPrimary,
                      }}
                      title={msg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                      aria-label={msg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                    >
                      <Star
                        size={15}
                        strokeWidth={2}
                        fill={msg.is_favorite ? "#f59e0b" : "none"}
                        color={msg.is_favorite ? "#f59e0b" : colors.textSecondary}
                        style={{ flexShrink: 0 }}
                      />
                      <span>{msg.is_favorite ? (t("unmarkImportant") || "Unstar") : (t("markImportant") || "Star")}</span>
                    </button>

                    {/* Read Aloud (TTS) with Language Selector */}
                    {isSpeechSynthesisSupported() && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          borderRadius: 6,
                          overflow: "visible",
                          position: "relative",
                        }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            onSpeak(msg);
                            setActiveMenuMsgId(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 500,
                            textAlign: "left",
                            borderRadius: 6,
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: speakingMsgId === msg.id ? colors.accent : colors.textPrimary,
                          }}
                          title={speakingMsgId === msg.id ? t("stopReading") : t("readAloud")}
                          aria-label={speakingMsgId === msg.id ? t("stopReading") : t("readAloud")}
                        >
                          {speakingMsgId === msg.id ? (
                            <VolumeX size={15} strokeWidth={2} color={colors.accent} style={{ flexShrink: 0 }} />
                          ) : (
                            <Volume2 size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                          )}
                          <span>{speakingMsgId === msg.id ? (t("stopReading") || "Stop reading") : (t("readAloud") || "Read aloud")}</span>
                        </button>

                        <div style={{ paddingRight: 6 }}>
                          <VoiceLanguageMenu
                            value={readAloudLang}
                            onSelect={(code) => {
                              onSelectReadAloudLang(code, msg);
                              setActiveMenuMsgId(null);
                            }}
                            isOpen={readAloudMenuMsgId === msg.id}
                            onClose={() => setReadAloudMenuMsgId(null)}
                            popupOnly
                            menuStyle={{ right: 0, left: "auto", bottom: "calc(100% + 4px)" }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReadAloudMenuMsgId(readAloudMenuMsgId === msg.id ? null : msg.id);
                              }}
                              style={{
                                background: colors.surfaceAlt,
                                border: `1px solid ${colors.borderStrong || colors.border}`,
                                borderRadius: 12,
                                padding: "2px 6px",
                                fontSize: 11,
                                color: colors.textSecondary,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                              title="Choose reading language"
                              aria-label="Choose reading language"
                            >
                              <Globe size={11} strokeWidth={2} />
                              <span>{VOICE_LANGUAGES.find((l) => l.code === readAloudLang)?.name?.slice(0, 3) || "Eng"}</span>
                              <ChevronDown size={10} strokeWidth={2} />
                            </button>
                          </VoiceLanguageMenu>
                        </div>
                      </div>
                    )}

                    {/* Copy to Clipboard */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        onCopy(msg);
                        setTimeout(() => setActiveMenuMsgId(null), 300);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        width: "100%",
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "left",
                        borderRadius: 6,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: copiedMsgId === msg.id ? colors.success : colors.textPrimary,
                      }}
                      title={copiedMsgId === msg.id ? (t("copied") || "Copied") : (t("copy") || "Copy")}
                      aria-label={copiedMsgId === msg.id ? (t("copied") || "Copied") : (t("copy") || "Copy")}
                    >
                      {copiedMsgId === msg.id ? (
                        <Check size={15} strokeWidth={2.5} color={colors.success} style={{ flexShrink: 0 }} />
                      ) : (
                        <Copy size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                      )}
                      <span>{copiedMsgId === msg.id ? (t("copied") || "Copied!") : (t("copy") || "Copy")}</span>
                    </button>

                    {/* Edit (own messages only) */}
                    {isOwn && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.body_text || "");
                          setActiveMenuMsgId(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          width: "100%",
                          fontSize: 13,
                          fontWeight: 500,
                          textAlign: "left",
                          borderRadius: 6,
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: colors.textPrimary,
                        }}
                        title={t("edit") || "Edit"}
                        aria-label={t("edit") || "Edit"}
                      >
                        <Pencil size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                        <span>{t("edit") || "Edit"}</span>
                      </button>
                    )}

                    {/* Delete (own messages only) */}
                    {isOwn && (
                      <>
                        <div style={{ height: 1, background: colors.border, margin: "4px 0" }} />
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => setDeletingMsgId(msg.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            width: "100%",
                            fontSize: 13,
                            fontWeight: 500,
                            textAlign: "left",
                            borderRadius: 6,
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: colors.danger,
                          }}
                          title={t("delete") || "Delete"}
                          aria-label={t("delete") || "Delete"}
                        >
                          <Trash2 size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                          <span>{t("delete") || "Delete"}</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>,
              document.body
            )}
          </div>

          {/* Subject on Root Message */}
          {!msg.in_reply_to && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: msg.subject && msg.subject.trim() && msg.subject !== "(no subject)" ? 700 : 400,
                color: colors.textSecondary,
                paddingBottom: 6,
                marginBottom: 6,
                borderBottom: `1px dashed ${colors.border}`,
              }}
            >
              <MailOpen size={12} strokeWidth={2} style={{ opacity: msg.subject && msg.subject.trim() && msg.subject !== "(no subject)" ? 1 : 0.6 }} />
              {msg.subject && msg.subject.trim() && msg.subject !== "(no subject)" ? (
                <span style={{ color: colors.textPrimary }}>{msg.subject}</span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: colors.textSecondary,
                    opacity: 0.6,
                  }}
                  title="No subject"
                >
                  <Minus size={12} strokeWidth={2.5} />
                </span>
              )}
            </div>
          )}

          {/* Referenced / Quoted Reply Block */}
          {msg.in_reply_to && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (referencedMsg?.id && onJumpToMessage) {
                  onJumpToMessage(referencedMsg.id);
                } else if (referencedMsg?.id) {
                  const el = document.getElementById(`msg-${referencedMsg.id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              style={{
                display: "flex",
                background: colors.quoteBackground,
                borderLeft: `3px solid ${colors.quoteBorder}`,
                borderRadius: 6,
                padding: "6px 10px",
                marginBottom: 8,
                fontSize: 12,
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
              title="Jump to quoted message"
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontWeight: 700, color: colors.accent, marginBottom: 2 }}>
                  {referencedMsg?.from_name || referencedMsg?.from_display || formatPhoneNumber(referencedMsg?.from_address || "Original Message")}
                </div>
                <div style={{ color: colors.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {referencedMsg?.body_text || referencedMsg?.subject || "(Referenced message)"}
                </div>
              </div>
            </div>
          )}

          {/* Message Body */}
          {editingMsgId === msg.id ? (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSaveEdit(msg.id);
                  } else if (e.key === "Escape") {
                    setEditingMsgId(null);
                  }
                }}
                autoFocus
                rows={2}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  borderRadius: 6,
                  border: `1px solid ${colors.accent}`,
                  background: colors.surface,
                  color: colors.textPrimary,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg.id)}
                  disabled={!editingText.trim()}
                  style={{
                    background: colors.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: editingText.trim() ? "pointer" : "default",
                    opacity: editingText.trim() ? 1 : 0.5,
                  }}
                  title="Save changes"
                  aria-label="Save changes"
                >
                  <Check size={13} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="icon-btn-danger"
                  onClick={() => setEditingMsgId(null)}
                  style={{
                    background: colors.surfaceAlt,
                    color: colors.danger,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 4,
                    padding: "4px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={13} strokeWidth={2} color={colors.danger} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
              {msg.body_text || (msg.body_html ? msg.body_html.replace(/<[^>]+>/g, "") : "")}
            </div>
          )}

          {/* Attachments rendering */}
          {msgAttachments.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {msgAttachments.map((att, attIdx) => {
                const mime = att.contentType || att.mime_type || "";
                const fname = att.filename || att.original_name || "Attachment";
                const isImg = mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fname);
                const isPdf = mime === "application/pdf" || /\.pdf$/i.test(fname);
                const isPreviewable = isImg || isPdf;

                return (
                  <div
                    key={att.id || attIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      background: colors.surfaceAlt,
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      fontSize: 12,
                    }}
                  >
                    <Paperclip size={14} strokeWidth={2} color={colors.textSecondary} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {fname}
                    </span>
                    {att.size && <span style={{ color: colors.textSecondary, flexShrink: 0 }}>{formatBytes(att.size)}</span>}
                    {att.id && isPreviewable && onPreviewAttachment && (
                      <button
                        type="button"
                        onClick={() => onPreviewAttachment({
                          id: att.id,
                          url: `${BASE_URL}/mail/attachments/${att.id}`,
                          filename: fname,
                          type: isImg ? "image" : "pdf",
                        })}
                        style={{
                          background: colors.accentLight,
                          border: `1px solid ${colors.borderStrong}`,
                          borderRadius: 4,
                          padding: "2px 8px",
                          color: colors.accent,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <Eye size={13} strokeWidth={2} />
                        <span>View</span>
                      </button>
                    )}
                    {att.id && (
                      <button
                        type="button"
                        onClick={() => downloadAttachment(att.id, fname)}
                        style={{
                          background: "none",
                          border: "none",
                          color: isPreviewable ? colors.textSecondary : colors.accent,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                          padding: "2px 4px",
                        }}
                        title={t("download") || "Download"}
                      >
                        <Download size={13} strokeWidth={2} />
                        {!isPreviewable && <span>{t("download") || "Download"}</span>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Speaking Indicator */}
          {speakingMsgId === msg.id && (
            <div
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: colors.accent,
                fontWeight: 600,
              }}
            >
              <Volume2 size={13} className="listening-pulse" />
              <span>Reading ({VOICE_LANGUAGES.find((l) => l.code === readAloudLang)?.name || "English"})</span>
            </div>
          )}

          {/* Fallback Voice Warning Note */}
          {voiceWarning?.msgId === msg.id && Boolean(voiceWarning?.text) && (
            <div
              style={{
                marginTop: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Globe size={11} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} />
              <span>{voiceWarning.text}</span>
            </div>
          )}

          {/* Footer: Time + (edited) indicator + Delivery Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              marginTop: 6,
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            {Boolean(msg.edited_at) && (
              <span
                style={{
                  fontSize: 10,
                  color: colors.textSecondary,
                  opacity: 0.7,
                  fontStyle: "italic",
                }}
                title={msg.edited_at ? `Edited at ${new Date(msg.edited_at).toLocaleTimeString()}` : "Edited"}
              >
                (edited)
              </span>
            )}

            <span>{timeStr}</span>

            {/* Delivery ticks for own messages */}
            {isOwn && (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                }}
                title={`Status: ${msg.delivery_status || "sent"}`}
              >
                {msg.delivery_status === "read" ? (
                  <CheckCheck size={14} color={colors.accent} />
                ) : msg.delivery_status === "delivered" ? (
                  <CheckCheck size={14} color={colors.textSecondary} />
                ) : (
                  <Check size={14} color={colors.textSecondary} />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatView({
  thread,
  folder = "home",
  me,
  onInitiateSend,
  onOpenTraditionalCompose,
  onReplyPrivately,
  onDeleteThread,
  onBack,
  scrollToMessageId,
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const isMobile = useIsMobile(768);

  const [readAloudLang, setReadAloudLang] = useState(() => {
    const defaultSpeechCode = VOICE_LANGUAGES.find((l) => l.code.startsWith(lang))?.code || "en-IN";
    return getSavedReadAloudLang(defaultSpeechCode);
  });
  const [readAloudMenuMsgId, setReadAloudMenuMsgId] = useState(null);
  const [voiceWarning, setVoiceWarning] = useState({ msgId: null, text: "" });

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const scrolledRef = useRef(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // message object being replied to
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const handleMessagesScroll = (e) => {
    const el = e.currentTarget;
    if (!el) return;
    el.classList.add("is-scrolling");
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      el.classList.remove("is-scrolling");
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // ── Message Actions Menu State & Handlers ────────────────────────────────
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMsgId, setDeletingMsgId] = useState(null);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest(".msg-actions-menu") && !e.target.closest(".msg-actions-trigger")) {
        setActiveMenuMsgId(null);
        setDeletingMsgId(null);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleCopyMessage = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.body_text || "");
      setCopiedMsgId(msg.id);
      setTimeout(() => {
        setCopiedMsgId((curr) => (curr === msg.id ? null : curr));
      }, 1200);
    } catch (err) {
      console.error("[ChatView] Failed to copy text:", err);
    }
  };

  const handleSaveEdit = async (msgId) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, body_text: trimmed, edited_at: now } : m))
    );
    setEditingMsgId(null);
    try {
      await updateEmail(msgId, { body_text: trimmed });
    } catch (err) {
      console.error("[ChatView] Failed to edit message:", err);
      loadMessages();
    }
  };

  const handleDeleteMessage = async (msg) => {
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setActiveMenuMsgId(null);
    setDeletingMsgId(null);
    try {
      await updateEmail(msg.id, { folder: "trash" });
    } catch (err) {
      console.error("[ChatView] Failed to delete message:", err);
      loadMessages();
    }
  };

  // ── Formal View Overlay State & Handlers ──────────────────────────────────
  const [formalOverlayMsg, setFormalOverlayMsg] = useState(null);
  const [isFormalClosing, setIsFormalClosing] = useState(false);
  const [formalDeletingConfirm, setFormalDeletingConfirm] = useState(false);

  const handleOpenFormalOverlay = (msg) => {
    setFormalOverlayMsg(msg);
    setIsFormalClosing(false);
    setFormalDeletingConfirm(false);
  };

  const handleCloseFormalOverlay = () => {
    setIsFormalClosing(true);
    setTimeout(() => {
      setFormalOverlayMsg(null);
      setIsFormalClosing(false);
      setFormalDeletingConfirm(false);
    }, 160);
  };

  useEffect(() => {
    if (!formalOverlayMsg) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseFormalOverlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formalOverlayMsg]);

  // ── Attachment Preview / Lightbox State ──────────────────────────────────
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (!previewAttachment) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setPreviewAttachment(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewAttachment]);

  // ── Voice-to-Text State ───────────────────────────────────────────────────
  const [voiceLang, setVoiceLang] = useState(getSavedSpeechLang());
  const [showVoiceLangMenu, setShowVoiceLangMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);
  const baseTextRef = useRef("");

  // ── Text-to-Speech State ──────────────────────────────────────────────────
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // ── AI Assist State ───────────────────────────────────────────────────────
  const [showAssist, setShowAssist] = useState(false);
  const [assisting, setAssisting] = useState(false);

  // Fetch messages when thread changes
  const loadMessages = async () => {
    if (!thread?.id) return;
    setLoading(true);
    try {
      const { data } = await getThreadMessages(thread.id, { folder });
      setMessages(data);
    } catch (err) {
      console.error("[ChatView] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavoriteMessage = async (msg) => {
    const nextVal = msg.is_favorite ? 0 : 1;
    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_favorite: nextVal } : m))
    );
    try {
      await updateEmail(msg.id, { is_favorite: nextVal });
    } catch (err) {
      console.error("[ChatView] Failed to toggle message favorite:", err);
      // Revert if failed
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_favorite: msg.is_favorite } : m))
      );
    }
  };

  // ── Multi-Select Mode State & Handlers ─────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());

  const handleToggleSelectMsg = (msgId) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleEnterSelection = (msgId) => {
    setSelectionMode(true);
    setSelectedMsgIds(new Set([msgId]));
  };

  const handleBulkStarSelected = async () => {
    if (selectedMsgIds.size === 0) return;
    const ids = Array.from(selectedMsgIds);
    const targetMsgs = messages.filter((m) => ids.includes(m.id));
    const allStarred = targetMsgs.every((m) => m.is_favorite);
    const newFavStatus = allStarred ? 0 : 1;

    setMessages((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, is_favorite: newFavStatus } : m))
    );
    setSelectedMsgIds(new Set());
    setSelectionMode(false);

    await Promise.allSettled(
      ids.map((id) => updateEmail(id, { is_favorite: newFavStatus }))
    );
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedMsgIds.size === 0) return;
    const ids = Array.from(selectedMsgIds);

    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
    setSelectedMsgIds(new Set());
    setSelectionMode(false);

    await Promise.allSettled(
      ids.map((id) => updateEmail(id, { folder: "trash" }))
    );
  };

  useEffect(() => {
    loadMessages();
    setReplyingTo(null);
    setAttachments([]);
    setText("");
    setSubject(thread?.subject || "");
    scrolledRef.current = null;
    setHighlightedMsgId(null);
    setIsSearching(false);
    setSearchQuery("");
    setSelectionMode(false);
    setSelectedMsgIds(new Set());
    setActiveMenuMsgId(null);
    setDeletingMsgId(null);
    setShowVoiceLangMenu(false);
    return () => {
      stopSpeaking();
      setShowVoiceLangMenu(false);
      if (recognizerRef.current) {
        try { recognizerRef.current.abort(); } catch {}
      }
    };
  }, [thread?.id, folder]);

  useEffect(() => {
    const targetId = scrollToMessageId || thread?.scrollToMessageId;
    if (targetId) {
      if (scrolledRef.current === targetId || loading || messages.length === 0) return;
      const timer = setTimeout(() => {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedMsgId(targetId);
          scrolledRef.current = targetId;
          setTimeout(() => {
            setHighlightedMsgId(null);
          }, 1800);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, scrollToMessageId, thread?.scrollToMessageId]);

  const highlightTimeoutRef = useRef(null);

  const handleJumpToMessage = (targetMsgId) => {
    if (!targetMsgId) return;
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(targetMsgId);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMsgId((curr) => (curr === targetMsgId ? null : curr));
      }, 1800);
    }
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Messages dictionary for quote preview lookup
  const messagesMap = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      if (m.id) map.set(m.id, m);
      if (m.message_id) map.set(m.message_id, m);
    });
    return map;
  }, [messages]);

  // ── In-Chat Message Search State & Handlers ────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef(null);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => {
      const body = (m.body_text || (m.body_html ? m.body_html.replace(/<[^>]+>/g, "") : "")).toLowerCase();
      const sub = (m.subject || "").toLowerCase();
      const sender = (m.from_name || m.from_display || m.from_address || "").toLowerCase();
      return body.includes(q) || sub.includes(q) || sender.includes(q);
    });
  }, [messages, searchQuery]);

  useEffect(() => {
    if (isSearching) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isSearching]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    handleJumpToMessage(searchMatches[nextIdx].id);
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    handleJumpToMessage(searchMatches[nextIdx].id);
  };

  const startVoiceRecognition = (langToUse) => {
    setError("");
    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    const targetLang = langToUse || voiceLang || getSavedSpeechLang();
    baseTextRef.current = text;
    const recognizer = createSpeechRecognizer({
      lang: targetLang,
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onError: (ev) => {
        setIsListening(false);
        if (ev.error !== "no-speech") setError(`Voice input error: ${ev.error}`);
      },
      onResult: ({ finalTranscript, interimTranscript }) => {
        const finalChunk = (finalTranscript || "").trim();
        const interimChunk = (interimTranscript || "").trim();

        if (finalChunk) {
          const base = baseTextRef.current;
          const sep = base && !base.endsWith(" ") && !base.endsWith("\n") ? " " : "";
          baseTextRef.current = base ? base + sep + finalChunk : finalChunk;
        }

        const currentBase = baseTextRef.current;
        if (interimChunk) {
          const sep = currentBase && !currentBase.endsWith(" ") && !currentBase.endsWith("\n") ? " " : "";
          setText(currentBase ? currentBase + sep + interimChunk : interimChunk);
        } else if (finalChunk) {
          setText(currentBase);
        }
      },
    });
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
    } catch (err) {
      setError("Could not start speech recognition: " + err.message);
      setIsListening(false);
    }
  };

  const handleVoiceToggle = () => {
    setError("");
    if (isListening) {
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch {}
      }
      setIsListening(false);
      setShowVoiceLangMenu(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    setShowVoiceLangMenu((prev) => !prev);
  };

  const handleSelectVoiceLang = (code) => {
    saveSpeechLang(code);
    setVoiceLang(code);
    setShowVoiceLangMenu(false);
    startVoiceRecognition(code);
  };

  const handleSelectReadAloudLang = (code, msg) => {
    saveReadAloudLang(code);
    setReadAloudLang(code);
    setReadAloudMenuMsgId(null);
    if (msg) {
      const textToSpeak = msg.body_text || msg.subject || "";
      if (textToSpeak.trim()) {
        speakText(textToSpeak, code, {
          onStart: () => setSpeakingMsgId(msg.id),
          onEnd: () => setSpeakingMsgId(null),
          onError: () => setSpeakingMsgId(null),
          onVoiceUnavailable: (missingLangCode) => {
            const langObj = VOICE_LANGUAGES.find((l) => l.code === missingLangCode);
            const langName = langObj ? langObj.name : missingLangCode;
            setVoiceWarning({
              msgId: msg.id,
              text: `No installed voice for ${langName} — using your device's default voice`,
            });
            setTimeout(() => {
              setVoiceWarning((prev) => (prev.msgId === msg.id ? { msgId: null, text: "" } : prev));
            }, 6000);
          },
        });
      }
    }
  };

  const handleSpeakMessage = (msg) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }
    const textToSpeak = msg.body_text || msg.subject || "";
    if (!textToSpeak.trim()) return;
    speakText(textToSpeak, readAloudLang, {
      onStart: () => setSpeakingMsgId(msg.id),
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
      onVoiceUnavailable: (missingLangCode) => {
        const langObj = VOICE_LANGUAGES.find((l) => l.code === missingLangCode);
        const langName = langObj ? langObj.name : missingLangCode;
        setVoiceWarning({
          msgId: msg.id,
          text: `No installed voice for ${langName} — using your device's default voice`,
        });
        setTimeout(() => {
          setVoiceWarning((prev) => (prev.msgId === msg.id ? { msgId: null, text: "" } : prev));
        }, 6000);
      },
    });
  };

  const handleAssist = async (intentPrompt) => {
    if (!intentPrompt.trim() || assisting) return;
    setAssisting(true);
    setError("");
    try {
      const isNew = messages.length === 0;
      const { data } = await assistDraft({
        threadId: thread?.id,
        intent: intentPrompt,
        isNewMessage: isNew,
        currentSubject: subject,
      });
      if (data.draft) {
        setText(data.draft);
        if (data.subject && !subject) setSubject(data.subject);
        setShowAssist(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to generate draft");
    } finally {
      setAssisting(false);
    }
  };

  const handleFileSelect = async (e) => {
    setError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        setError(`"${file.name}" exceeds the 10MB limit.`);
        e.target.value = "";
        return;
      }
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { data } = await uploadAttachment(file);
        uploaded.push(data);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to upload attachment");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    setError("");
    if (!text.trim() && attachments.length === 0) return;

    // Determine recipients
    let toPayload;
    if (thread.is_group) {
      // In a group, send to all participants except me
      const pList = thread.participants || [];
      const others = pList.filter((p) => p !== me?.email_address);
      toPayload = others.length > 0 ? others : thread.counterpart;
    } else {
      toPayload = thread.counterpart;
    }

    const sentSubject = replyingTo ? undefined : (subject?.trim() || undefined);
    const payload = {
      to: toPayload,
      subject: sentSubject,
      text: text.trim(),
      attachments,
      inReplyTo: replyingTo ? (replyingTo.message_id || replyingTo.id) : null,
    };

    const draftData = {
      to: toPayload,
      subject: sentSubject,
      body: text,
      attachments,
      threadId: thread.id,
      inReplyTo: replyingTo ? (replyingTo.message_id || replyingTo.id) : null,
    };

    onInitiateSend(payload, draftData);

    // Optimistic addition
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      from_address: me?.email_address,
      from_name: me?.display_name,
      to_address: Array.isArray(toPayload) ? toPayload.join(", ") : toPayload,
      subject: payload.subject,
      body_text: payload.text,
      created_at: new Date().toISOString(),
      attachments,
      in_reply_to: payload.inReplyTo,
      delivery_status: "sent",
      status: "sending",
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setText("");
    setAttachments([]);
    setReplyingTo(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!thread) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textSecondary,
          background: colors.surface,
          gap: 12,
        }}
      >
      <div style={{ fontSize: 48, color: colors.textSecondary, display: "flex", justifyContent: "center" }}>
          <MailOpen size={52} strokeWidth={1.2} color={colors.textSecondary} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Select a conversation to start chatting</div>
        <div style={{ fontSize: 13 }}>Or use the compose button to start a new message</div>
      </div>
    );
  }

  // Header Details
  const isGroup = Boolean(thread.is_group);
  const headerDisplayName = isGroup
    ? (thread.group_name || thread.counterpart || "Group Conversation")
    : (thread.counterpart_name || formatPhoneNumber(thread.counterpart || ""));

  const initials = getAvatarInitials(headerDisplayName, isGroup);
  const avatarBg = getAvatarColor(thread.counterpart || thread.group_name);

  // Formal Overlay derived values
  const formalIsOwn = formalOverlayMsg ? (formalOverlayMsg.from_address === me?.email_address) : false;
  const formalSenderName = formalOverlayMsg
    ? (formalIsOwn ? (me?.display_name || "You") : (formalOverlayMsg.from_name || formalOverlayMsg.from_display || formatPhoneNumber(formalOverlayMsg.from_address || "")))
    : "";
  const formalFormattedDate = formalOverlayMsg?.created_at
    ? new Date(formalOverlayMsg.created_at).toLocaleString([], {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const formalReferencedMsg = (formalOverlayMsg && formalOverlayMsg.in_reply_to) ? messagesMap.get(formalOverlayMsg.in_reply_to) : null;
  const formalAttachments = Array.isArray(formalOverlayMsg?.attachments)
    ? formalOverlayMsg.attachments
    : (() => {
        try {
          return JSON.parse(formalOverlayMsg?.attachments || "[]");
        } catch {
          return [];
        }
      })();


  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: colors.bg,
        position: "relative",
      }}
    >
      {/* ── Conversation Header ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "10px 14px" : "10px 20px",
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          zIndex: 10,
        }}
      >
        {selectionMode ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: 6,
                  color: colors.danger,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Cancel selection"
                aria-label="Cancel selection"
              >
                <X size={20} strokeWidth={2} color={colors.danger} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>
                {selectedMsgIds.size} selected
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={handleBulkStarSelected}
                disabled={selectedMsgIds.size === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${colors.borderStrong}`,
                  background: colors.surfaceAlt,
                  color: colors.textPrimary,
                  cursor: selectedMsgIds.size > 0 ? "pointer" : "default",
                  opacity: selectedMsgIds.size > 0 ? 1 : 0.5,
                  fontSize: 13,
                  fontWeight: 600,
                }}
                title="Star / unstar selected"
                aria-label="Star / unstar selected"
              >
                <Star size={16} strokeWidth={2} color="#d97706" />
                <span>Star</span>
              </button>

              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={handleBulkDeleteSelected}
                disabled={selectedMsgIds.size === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${selectedMsgIds.size > 0 ? colors.danger : colors.border}`,
                  background: selectedMsgIds.size > 0 ? colors.dangerBg : colors.surfaceAlt,
                  color: selectedMsgIds.size > 0 ? colors.danger : colors.textSecondary,
                  cursor: selectedMsgIds.size > 0 ? "pointer" : "default",
                  opacity: selectedMsgIds.size > 0 ? 1 : 0.5,
                  fontSize: 13,
                  fontWeight: 600,
                }}
                title="Delete selected"
                aria-label="Delete selected"
              >
                <Trash2 size={16} strokeWidth={2} color={selectedMsgIds.size > 0 ? colors.danger : colors.textSecondary} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {onBack && isMobile && (
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: colors.textPrimary,
                    fontSize: 20,
                    padding: "4px 8px 4px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  ←
                </button>
              )}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  {isGroup && <Users size={15} strokeWidth={2} color={colors.textSecondary} />}
                  {headerDisplayName}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isGroup
                    ? `Group · ${(thread.participants || []).length} participants`
                    : (thread.counterpart_phone ? formatPhoneNumber(thread.counterpart_phone) : thread.counterpart)}
                </div>
              </div>
            </div>

            {/* Action Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setIsSearching((prev) => !prev);
                  setSearchQuery("");
                }}
                className="icon-btn"
                style={{
                  border: "none",
                  background: isSearching ? colors.surfaceHover : "none",
                  cursor: "pointer",
                  padding: "6px",
                  color: isSearching ? colors.accent : colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 6,
                }}
                title={t("searchInChat") || "Search in conversation"}
                aria-label={t("searchInChat") || "Search in conversation"}
              >
                <Search size={17} strokeWidth={2} />
              </button>

              {onDeleteThread && (
                <button
                  type="button"
                  onClick={() => onDeleteThread(thread)}
                  className="icon-btn icon-btn-danger"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: "6px",
                    color: colors.textSecondary,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={t("moveToTrash")}
                >
                  <Trash2 size={17} strokeWidth={2} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── In-Chat Message Search Bar ────────────────────────────────────────── */}
      {isSearching && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: colors.surfaceAlt,
            borderBottom: `1px solid ${colors.border}`,
            zIndex: 9,
          }}
        >
          <Search size={16} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t("searchChatPlaceholder") || "Search messages…"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) handlePrevMatch();
                else handleNextMatch();
              } else if (e.key === "Escape") {
                setIsSearching(false);
                setSearchQuery("");
              }
            }}
            style={{
              flex: 1,
              background: colors.surface,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 13,
              color: colors.textPrimary,
              outline: "none",
            }}
          />
          {searchQuery.trim() && (
            <span style={{ fontSize: 12, color: colors.textSecondary, flexShrink: 0, whiteSpace: "nowrap" }}>
              {searchMatches.length > 0
                ? `${currentMatchIdx + 1} of ${searchMatches.length}`
                : (t("noMessagesFound") || "0 matches")}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={handlePrevMatch}
              disabled={searchMatches.length === 0}
              style={{
                border: searchMatches.length > 0 ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: searchMatches.length > 0 ? colors.accentLight : "transparent",
                cursor: searchMatches.length > 0 ? "pointer" : "default",
                color: searchMatches.length > 0 ? colors.accent : colors.borderStrong,
                boxShadow: searchMatches.length > 0 ? `0 0 0 1px ${colors.accent}` : "none",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                opacity: searchMatches.length > 0 ? 1 : 0.45,
              }}
              title="Previous match"
              aria-label="Previous match"
            >
              <ChevronUp size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={handleNextMatch}
              disabled={searchMatches.length === 0}
              style={{
                border: searchMatches.length > 0 ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: searchMatches.length > 0 ? colors.accentLight : "transparent",
                cursor: searchMatches.length > 0 ? "pointer" : "default",
                color: searchMatches.length > 0 ? colors.accent : colors.borderStrong,
                boxShadow: searchMatches.length > 0 ? `0 0 0 1px ${colors.accent}` : "none",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                opacity: searchMatches.length > 0 ? 1 : 0.45,
              }}
              title="Next match"
              aria-label="Next match"
            >
              <ChevronDown size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: colors.danger,
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                marginLeft: 4,
              }}
              title="Close search"
              aria-label="Close search"
            >
              <X size={16} strokeWidth={2} color={colors.danger} />
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable Chat Bubble Stream ──────────────────────────────────── */}
      <div
        className="chat-scroll-container"
        onScroll={handleMessagesScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "16px 12px" : "20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: colors.textSecondary }}>
            Loading conversation…
          </div>
        ) : null}

        {messages.map((msg, index) => {
          const isOwn = msg.from_address === me?.email_address;
          const referencedMsg = msg.in_reply_to ? messagesMap.get(msg.in_reply_to) : null;

          return (
            <MessageBubbleItem
              key={msg.id || index}
              msg={msg}
              index={index}
              isOwn={isOwn}
              isGroup={isGroup}
              me={me}
              colors={colors}
              isMobile={isMobile}
              highlightedMsgId={highlightedMsgId}
              referencedMsg={referencedMsg}
              activeMenuMsgId={activeMenuMsgId}
              setActiveMenuMsgId={setActiveMenuMsgId}
              deletingMsgId={deletingMsgId}
              setDeletingMsgId={setDeletingMsgId}
              editingMsgId={editingMsgId}
              setEditingMsgId={setEditingMsgId}
              editingText={editingText}
              setEditingText={setEditingText}
              copiedMsgId={copiedMsgId}
              speakingMsgId={speakingMsgId}
              onReply={(m) => {
                setReplyingTo(m);
                setTimeout(() => textInputRef.current?.focus(), 60);
              }}
              onReplyPrivately={onReplyPrivately}
              onToggleFavorite={handleToggleFavoriteMessage}
              onSpeak={handleSpeakMessage}
              onCopy={handleCopyMessage}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDeleteMessage}
              onOpenFormal={handleOpenFormalOverlay}
              onJumpToMessage={handleJumpToMessage}
              onPreviewAttachment={setPreviewAttachment}
              downloadAttachment={downloadAttachment}
              formatBytes={formatBytes}
              t={t}
              selectionMode={selectionMode}
              isSelected={selectedMsgIds.has(msg.id)}
              onToggleSelect={handleToggleSelectMsg}
              onEnterSelection={handleEnterSelection}
              readAloudLang={readAloudLang}
              onSelectReadAloudLang={handleSelectReadAloudLang}
              readAloudMenuMsgId={readAloudMenuMsgId}
              setReadAloudMenuMsgId={setReadAloudMenuMsgId}
              voiceWarning={voiceWarning}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Floating Compose Bar (WhatsApp Style) ────────────────────── */}
      <div
        style={{
          background: "transparent",
          padding: isMobile ? "0 8px 10px 8px" : "0 20px 16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: colors.surface,
            borderRadius: (replyingTo || attachments.length > 0 || showAssist || (!replyingTo && subject)) ? 18 : 28,
            border: `1px solid ${colors.border}`,
            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06)",
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxWidth: 860,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            transition: "all 0.2s ease",
          }}
        >
          {error && (
            <div style={{ padding: "4px 10px", background: colors.dangerBg, color: colors.danger, borderRadius: 6, fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Replying Banner */}
          {replyingTo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                background: colors.surfaceAlt,
                borderLeft: `3px solid ${colors.accent}`,
                borderRadius: "4px 8px 8px 4px",
                fontSize: 12,
              }}
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <span style={{ fontWeight: 700, color: colors.accent }}>
                  Replying to{" "}
                  {replyingTo.from_name || replyingTo.from_display || formatPhoneNumber(replyingTo.from_address || "User")}
                  :{" "}
                </span>
                <span style={{ color: colors.textSecondary }}>
                  {replyingTo.body_text || replyingTo.subject || "Message"}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => setReplyingTo(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: "2px", display: "flex", alignItems: "center" }}
                title="Cancel reply"
              >
                <X size={14} color={colors.danger} />
              </button>
            </div>
          )}

          {/* Compact Subject Field (Shown for non-reply emails, hidden when replying to a message) */}
          {!replyingTo && (
            <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 4px" }}>
              <input
                type="text"
                placeholder={t("subjectOptional") || "Subject (optional)"}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 26,
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceAlt,
                  fontSize: 12,
                  color: colors.textPrimary,
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderStrong; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
              />
            </div>
          )}

          {/* Attachment Chips */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 4px" }}>
              {attachments.map((att, i) => (
                <div
                  key={att.id || i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: colors.surfaceAlt,
                    border: `1px solid ${colors.border}`,
                    fontSize: 12,
                  }}
                >
                  <Paperclip size={12} strokeWidth={2} color={colors.textSecondary} />
                  <span>{att.filename || "file"}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => removeAttachment(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: "2px", display: "flex", alignItems: "center" }}
                    title="Remove attachment"
                  >
                    <X size={12} strokeWidth={2} color={colors.danger} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AI Assist Intent Chips Drawer */}
          {showAssist && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px" }}>
              {ASSIST_INTENT_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={assisting}
                  onClick={() => handleAssist(chip.intent)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    background: colors.surfaceAlt,
                    color: colors.textPrimary,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Main Pill Input Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: colors.surfaceAlt,
              borderRadius: 22,
              padding: "3px 6px",
              border: `1px solid ${colors.borderStrong || colors.border}`,
            }}
          >
            {/* Paperclip File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="icon-btn"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                color: colors.textSecondary,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title={t("attachFile")}
              aria-label={t("attachFile")}
            >
              <Paperclip size={18} strokeWidth={2} />
            </button>

            {/* AI Assist Toggle */}
            <button
              type="button"
              onClick={() => setShowAssist(!showAssist)}
              className={showAssist ? "" : "icon-btn"}
              style={{
                background: showAssist ? colors.accentLight : "none",
                border: showAssist ? `1px solid ${colors.accent}` : "none",
                cursor: "pointer",
                padding: "6px",
                color: showAssist ? colors.accent : colors.textSecondary,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title={t("aiDraftAssistant")}
              aria-label={t("aiDraftAssistant")}
            >
              <Sparkles size={17} strokeWidth={2} />
            </button>

            {/* Message Input Textarea */}
            <textarea
              ref={textInputRef}
              placeholder={isListening ? t("typeMessageListening") : t("typeMessage")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 0,
                border: "none",
                background: "transparent",
                color: colors.textPrimary,
                fontSize: 14,
                resize: "none",
                outline: "none",
                minHeight: 24,
                maxHeight: 120,
                lineHeight: 1.4,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {/* Voice Recognition Mic Button with Language Picker */}
            {isSpeechRecognitionSupported() && (
              <VoiceLanguageMenu
                isOpen={showVoiceLangMenu}
                onClose={() => setShowVoiceLangMenu(false)}
                value={voiceLang}
                onSelect={handleSelectVoiceLang}
                popupOnly
              >
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={isListening ? "listening-pulse" : "icon-btn"}
                  style={{
                    background: isListening ? colors.danger : "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px",
                    color: isListening ? "#fff" : colors.textSecondary,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title={isListening ? "Stop listening" : t("voiceToText")}
                  aria-label={isListening ? "Stop listening" : t("voiceToText")}
                >
                  {isListening ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
                </button>
              </VoiceLanguageMenu>
            )}

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() && attachments.length === 0}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                border: "none",
                background: (text.trim() || attachments.length > 0) ? colors.accent : "transparent",
                color: (text.trim() || attachments.length > 0) ? "#fff" : colors.textSecondary,
                cursor: (text.trim() || attachments.length > 0) ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
                opacity: (text.trim() || attachments.length > 0) ? 1 : 0.4,
              }}
              title={t("sendMessage")}
              aria-label={t("sendMessage")}
            >
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Formal View Overlay ("formal view" overlay) ───────────────────────── */}
      {formalOverlayMsg && (
        <div
          className={`formal-overlay-backdrop ${isFormalClosing ? "closing" : ""}`}
          onClick={handleCloseFormalOverlay}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "12px 8px" : 24,
          }}
        >
          <div
            className={`formal-overlay-card ${isFormalClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "92%",
              background: colors.surface,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 16,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Overlay Header & Toolbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                background: colors.surfaceAlt,
                borderBottom: `1px solid ${colors.border}`,
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>
                <MailOpen size={16} strokeWidth={2} color={colors.accent} />
                <span>{t("messageDetails") || "Message Details"}</span>
              </div>

              {/* Action Toolbar (Icon-only actions identical to dropdown menu) */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {formalDeletingConfirm ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: colors.danger, fontWeight: 500, whiteSpace: "nowrap" }}>
                      Delete this message?
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => {
                        handleDeleteMessage(formalOverlayMsg);
                        handleCloseFormalOverlay();
                      }}
                      style={{
                        background: colors.dangerBg,
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        color: colors.danger,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Confirm delete"
                      aria-label="Confirm delete"
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => setFormalDeletingConfirm(false)}
                      style={{
                        background: colors.surfaceAlt,
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        color: colors.danger,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Cancel delete"
                      aria-label="Cancel delete"
                    >
                      <X size={14} strokeWidth={2} color={colors.danger} />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Reply */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setReplyingTo(formalOverlayMsg);
                        handleCloseFormalOverlay();
                        setTimeout(() => textInputRef.current?.focus(), 80);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: 6,
                        color: colors.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={t("replyDirectly") || "Reply"}
                      aria-label={t("replyDirectly") || "Reply"}
                    >
                      <Reply size={16} strokeWidth={2} />
                    </button>

                    {/* Reply Privately (group chats from others) */}
                    {thread.is_group && !formalIsOwn && onReplyPrivately && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          onReplyPrivately(formalOverlayMsg);
                          handleCloseFormalOverlay();
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: 6,
                          color: colors.textSecondary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={t("replyPrivate") || "Reply privately in 1:1 chat"}
                        aria-label={t("replyPrivate") || "Reply privately in 1:1 chat"}
                      >
                        <Reply size={16} strokeWidth={2} style={{ transform: "scaleX(-1)" }} />
                      </button>
                    )}

                    {/* Star / Unstar */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        handleToggleFavoriteMessage(formalOverlayMsg);
                        setFormalOverlayMsg((prev) =>
                          prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : null
                        );
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: 6,
                        color: formalOverlayMsg.is_favorite ? "#d97706" : colors.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={formalOverlayMsg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                      aria-label={formalOverlayMsg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                    >
                      <Star size={16} strokeWidth={2} fill={formalOverlayMsg.is_favorite ? "#d97706" : "none"} />
                    </button>

                    {/* Read Aloud (TTS) with Language Selector */}
                    {isSpeechSynthesisSupported() && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleSpeakMessage(formalOverlayMsg)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "6px",
                            borderRadius: 6,
                            color: speakingMsgId === formalOverlayMsg.id ? colors.accent : colors.textSecondary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title={speakingMsgId === formalOverlayMsg.id ? t("stopReading") : t("readAloud")}
                          aria-label={speakingMsgId === formalOverlayMsg.id ? t("stopReading") : t("readAloud")}
                        >
                          {speakingMsgId === formalOverlayMsg.id ? (
                            <VolumeX size={16} strokeWidth={2} />
                          ) : (
                            <Volume2 size={16} strokeWidth={2} />
                          )}
                        </button>
                        <VoiceLanguageMenu
                          value={readAloudLang}
                          onSelect={(code) => handleSelectReadAloudLang(code, formalOverlayMsg)}
                          isOpen={readAloudMenuMsgId === formalOverlayMsg.id}
                          onClose={() => setReadAloudMenuMsgId(null)}
                          popupOnly
                          menuStyle={{ right: 0, left: "auto", top: "calc(100% + 4px)", bottom: "auto" }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReadAloudMenuMsgId(readAloudMenuMsgId === formalOverlayMsg.id ? null : formalOverlayMsg.id);
                            }}
                            style={{
                              background: colors.surfaceAlt,
                              border: `1px solid ${colors.borderStrong || colors.border}`,
                              borderRadius: 12,
                              padding: "2px 6px",
                              fontSize: 11,
                              color: colors.textSecondary,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                            title="Choose reading language"
                            aria-label="Choose reading language"
                          >
                            <Globe size={11} strokeWidth={2} />
                            <span>{VOICE_LANGUAGES.find((l) => l.code === readAloudLang)?.name?.slice(0, 3) || "Eng"}</span>
                            <ChevronDown size={10} strokeWidth={2} />
                          </button>
                        </VoiceLanguageMenu>
                      </div>
                    )}

                    {/* Copy to Clipboard */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleCopyMessage(formalOverlayMsg)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: 6,
                        color: copiedMsgId === formalOverlayMsg.id ? colors.success : colors.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={copiedMsgId === formalOverlayMsg.id ? "Copied" : "Copy to clipboard"}
                      aria-label={copiedMsgId === formalOverlayMsg.id ? "Copied" : "Copy to clipboard"}
                    >
                      {copiedMsgId === formalOverlayMsg.id ? (
                        <Check size={16} strokeWidth={2.5} color={colors.success} />
                      ) : (
                        <Copy size={16} strokeWidth={2} />
                      )}
                    </button>

                    {/* Edit (own messages only) */}
                    {formalIsOwn && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setEditingMsgId(formalOverlayMsg.id);
                          setEditingText(formalOverlayMsg.body_text || "");
                          handleCloseFormalOverlay();
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: 6,
                          color: colors.textSecondary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                    )}

                    {/* Delete (own messages only) */}
                    {formalIsOwn && (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => setFormalDeletingConfirm(true)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: 6,
                          color: colors.textSecondary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Delete message"
                        aria-label="Delete message"
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    )}

                    <div style={{ width: 1, height: 18, background: colors.border, margin: "0 4px" }} />

                    {/* Close (X) button */}
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={handleCloseFormalOverlay}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: 6,
                        color: colors.danger,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Close overlay"
                      aria-label="Close overlay"
                    >
                      <X size={18} strokeWidth={2} color={colors.danger} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Scrollable Formal Content */}
            <div
              className="chat-scroll-container"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "16px 14px" : "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Voice Warning Note */}
              {voiceWarning?.msgId === formalOverlayMsg.id && Boolean(voiceWarning?.text) && (
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: colors.surfaceAlt,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Globe size={13} strokeWidth={2} color={colors.textSecondary} style={{ flexShrink: 0 }} />
                  <span>{voiceWarning.text}</span>
                </div>
              )}

              {/* Subject */}
              <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                {formalOverlayMsg.subject &&
                formalOverlayMsg.subject.trim() &&
                formalOverlayMsg.subject !== "(no subject)" ? (
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.textPrimary,
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {formalOverlayMsg.subject}
                  </h2>
                ) : (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: colors.textSecondary,
                      opacity: 0.6,
                      fontSize: 14,
                    }}
                    title="No subject"
                  >
                    <Minus size={14} strokeWidth={2.5} />
                    <span style={{ fontStyle: "italic" }}>(no subject)</span>
                  </div>
                )}
              </div>

              {/* Sender & Recipient Metadata */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  background: colors.surfaceAlt,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    background: getAvatarColor(formalOverlayMsg.from_address),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {getAvatarInitials(formalSenderName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                      {formalSenderName}
                      <span style={{ fontWeight: 400, color: colors.textSecondary, marginLeft: 6, fontSize: 13 }}>
                        &lt;{formalOverlayMsg.from_address}&gt;
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>
                      {formalFormattedDate}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                    <span>To: </span>
                    <span style={{ color: colors.textPrimary }}>
                      {formalOverlayMsg.to_address || (thread.is_group ? thread.group_name : (thread.counterpart_name || thread.counterpart))}
                    </span>
                    {formalOverlayMsg.edited_at && (
                      <span style={{ marginLeft: 8, fontStyle: "italic", opacity: 0.75 }}>
                        (edited {new Date(formalOverlayMsg.edited_at).toLocaleTimeString()})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Referenced / Quoted Reply Block */}
              {formalReferencedMsg && (
                <div
                  style={{
                    background: colors.quoteBackground,
                    borderLeft: `3px solid ${colors.quoteBorder}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700, color: colors.accent, marginBottom: 2 }}>
                    {formalReferencedMsg.from_name || formalReferencedMsg.from_display || formatPhoneNumber(formalReferencedMsg.from_address || "Original Message")}
                  </div>
                  <div style={{ color: colors.textSecondary, whiteSpace: "pre-wrap" }}>
                    {formalReferencedMsg.body_text || formalReferencedMsg.subject || "(Referenced message)"}
                  </div>
                </div>
              )}

              {/* Complete Body Text (Enlarged, readable font) */}
              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.65,
                  color: colors.textPrimary,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  padding: "4px 2px",
                }}
              >
                {formalOverlayMsg.body_text || (formalOverlayMsg.body_html ? formalOverlayMsg.body_html.replace(/<[^>]+>/g, "") : "")}
              </div>

              {/* Attachments & Images (Enlarged display) */}
              {formalAttachments.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
                    <Paperclip size={14} />
                    <span>Attachments ({formalAttachments.length})</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {formalAttachments.map((att, attIdx) => {
                      const mime = att.contentType || att.mime_type || "";
                      const fname = att.filename || att.original_name || "Attachment";
                      const isImg = mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fname);
                      const isPdf = mime === "application/pdf" || /\.pdf$/i.test(fname);
                      const isPreviewable = isImg || isPdf;
                      const inlineUrl = att.id ? `${BASE_URL}/mail/attachments/${att.id}` : att.url;

                      return (
                        <div
                          key={att.id || attIdx}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: 10,
                            background: colors.surfaceAlt,
                            overflow: "hidden",
                          }}
                        >
                          {isImg && inlineUrl && (
                            <div style={{ background: "rgba(0,0,0,0.03)", padding: 10, display: "flex", justifyContent: "center" }}>
                              <img
                                src={inlineUrl}
                                alt={fname}
                                onClick={() => setPreviewAttachment({
                                  id: att.id,
                                  url: inlineUrl,
                                  filename: fname,
                                  type: "image",
                                })}
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: 320,
                                  borderRadius: 6,
                                  objectFit: "contain",
                                  display: "block",
                                  cursor: "pointer",
                                }}
                                title="Click to view full image"
                              />
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              gap: 12,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                              <Paperclip size={16} strokeWidth={2} color={colors.textSecondary} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {fname}
                              </span>
                              {att.size && (
                                <span style={{ fontSize: 12, color: colors.textSecondary, flexShrink: 0 }}>
                                  {formatBytes(att.size)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {att.id && isPreviewable && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment({
                                    id: att.id,
                                    url: inlineUrl,
                                    filename: fname,
                                    type: isImg ? "image" : "pdf",
                                  })}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    background: colors.accentLight,
                                    border: `1px solid ${colors.borderStrong}`,
                                    color: colors.accent,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                >
                                  <Eye size={14} strokeWidth={2} />
                                  <span>View</span>
                                </button>
                              )}
                              {att.id && (
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(att.id, fname)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    background: colors.surface,
                                    border: `1px solid ${colors.borderStrong}`,
                                    color: isPreviewable ? colors.textSecondary : colors.accent,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                >
                                  <Download size={14} strokeWidth={2} />
                                  <span>{t("download")}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Modal for Attachment Viewing (Images & PDFs) */}
      {previewAttachment && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(4px)",
            zIndex: 3000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
          }}
        >
          {/* Top control bar */}
          <div
            style={{
              width: "100%",
              maxWidth: previewAttachment.type === "pdf" ? 920 : "90vw",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              {previewAttachment.filename}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => downloadAttachment(previewAttachment.id, previewAttachment.filename)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(255, 255, 255, 0.18)",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title={t("download") || "Download"}
              >
                <Download size={14} strokeWidth={2} />
                <span>{t("download") || "Download"}</span>
              </button>
              <button
                type="button"
                className="icon-btn-danger"
                onClick={() => setPreviewAttachment(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.18)",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  color: colors.danger,
                  cursor: "pointer",
                }}
                title="Close"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} color={colors.danger} />
              </button>
            </div>
          </div>

          {/* Viewer Content */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 80px)",
            }}
          >
            {previewAttachment.type === "image" ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.filename}
                style={{
                  maxWidth: "90vw",
                  maxHeight: "82vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
                }}
              />
            ) : previewAttachment.type === "pdf" ? (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.filename}
                style={{
                  width: "90vw",
                  maxWidth: 920,
                  height: "82vh",
                  border: "none",
                  borderRadius: 8,
                  background: "#ffffff",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
