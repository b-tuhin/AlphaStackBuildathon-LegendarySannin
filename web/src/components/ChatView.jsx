import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
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
  Eye,
  Search,
  ChevronUp,
  ChevronDown,
  Globe,
  Languages,
} from "lucide-react";
import ComposeIcon from "./ComposeIcon.jsx";
import { useNavigate } from "react-router-dom";
import {
  getThreadMessages,
  uploadAttachment,
  assistDraft,
  translateMessage,
  downloadAttachment,
  updateEmail,
  lookupPhone,
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
import Avatar from "./Avatar.jsx";
import GroupInfoModal from "./GroupInfoModal.jsx";
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
  detectScriptLanguage,
  getVoiceLangForCode,
} from "../utils/speech.js";
import ThemedCheckbox from "./ThemedCheckbox.jsx";
import VoiceLanguageMenu from "./VoiceLanguageMenu.jsx";
import PlaceholderResolverBar from "./PlaceholderResolverBar.jsx";
import { translateInBrowser } from "../utils/translateFallback.js";
import { highlightText } from "../utils/textHighlight.jsx";


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

function isActualSubjectValue(candidate, ...bodyTexts) {
  if (!candidate || typeof candidate !== "string") return false;
  const cleanSub = candidate.trim();
  if (!cleanSub) return false;
  if (/^\(?no subject\)?$/i.test(cleanSub) || cleanSub === "-") return false;

  for (const b of bodyTexts) {
    if (b && typeof b === "string") {
      const cleanBody = b.trim();
      if (!cleanBody) continue;
      if (cleanSub.toLowerCase() === cleanBody.toLowerCase()) return false;
      if (cleanBody.toLowerCase().startsWith(cleanSub.toLowerCase()) && cleanSub.length >= 3) return false;
      if (cleanSub.toLowerCase().startsWith(cleanBody.toLowerCase()) && cleanBody.length >= 3) return false;
    }
  }

  return true;
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
  onTranslationTriggered,
  topGap = 12,
  searchQuery = "",
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  const { lang, supportedLanguages } = useI18n();
  const [translation, setTranslation] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslateSubmenu, setShowTranslateSubmenu] = useState(false);

  const rawBodyText = msg.body_text || (msg.body_html ? msg.body_html.replace(/<[^>]+>/g, "") : "") || "";
  const detectedBubbleLang = useMemo(() => detectScriptLanguage(rawBodyText, lang), [rawBodyText, lang]);

  const isTranslated = Boolean(
    translation &&
    !translation.showOriginal &&
    translation.text &&
    translation.text.trim() &&
    translation.text.trim() !== rawBodyText.trim()
  );
  const isShowingTranslated = isTranslated;
  const displayedBodyText = isTranslated ? translation.text : (msg.body_text || rawBodyText);
  const shouldShowInlineTranslate = Boolean(rawBodyText.trim() && (detectedBubbleLang !== lang || isTranslated));

  const getLanguageLabel = (code) => {
    const found = supportedLanguages?.find((l) => l.code === code);
    return found?.label || found?.name || code;
  };

  const handleTranslateTo = async (targetCode) => {
    if (!rawBodyText.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      let translated = null;
      let unchanged = false;
      try {
        const res = await translateMessage({
          text: rawBodyText,
          targetLangCode: targetCode,
        });
        translated = res?.data?.translatedText;
        unchanged = Boolean(res?.data?.unchanged);
      } catch (apiErr) {
        // The server couldn't reach a translation provider: try from the browser.
        console.warn("Server translation failed, trying browser fallback:", apiErr?.message);
        translated = await translateInBrowser(rawBodyText, targetCode);
      }
      if (
        !unchanged &&
        translated &&
        typeof translated === "string" &&
        translated.trim() &&
        translated.trim() !== rawBodyText.trim()
      ) {
        setTranslation({
          text: translated.trim(),
          targetLang: targetCode,
          fromLang: detectedBubbleLang,
          showOriginal: false,
        });
        onTranslationTriggered?.("info");
      } else {
        setTranslation(null);
        onTranslationTriggered?.("same");
      }
    } catch (err) {
      console.error("Translation failed:", err);
      setTranslation(null);
      onTranslationTriggered?.("error");
    } finally {
      setIsTranslating(false);
      setShowTranslateSubmenu(false);
      setActiveMenuMsgId(null);
    }
  };

  const handleToggleTranslate = async (e) => {
    e.stopPropagation();
    if (isTranslating) return;

    if (translation && translation.text && translation.text.trim() !== rawBodyText.trim()) {
      const nextShowOriginal = !translation.showOriginal;
      setTranslation((prev) => ({
        ...prev,
        showOriginal: nextShowOriginal,
      }));
      if (!nextShowOriginal) {
        onTranslationTriggered?.("info");
      }
      return;
    }

    await handleTranslateTo(lang);
  };

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

  useLayoutEffect(() => {
    if (activeMenuMsgId !== msg.id || !menuRef.current) {
      setMenuPosition(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const trg = triggerBtnRef.current ? triggerBtnRef.current.getBoundingClientRect() : null; const need = menuRef.current.scrollHeight + 8; const below = trg ? window.innerHeight - trg.bottom - 12 : 9999; const above = trg ? trg.top - 12 : 0; const openUp = trg ? (below < need && above > below) : false; const maxHeight = Math.max(160, Math.min(need, openUp ? above : below));
    const alignLeft = trg ? trg.right - menuRef.current.offsetWidth < 8 : false;
    setMenuPosition({ openUp, alignLeft, maxHeight });
  }, [activeMenuMsgId, msg.id, deletingMsgId, showTranslateSubmenu]);

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
  }, [activeMenuMsgId, msg.id, setActiveMenuMsgId, setDeletingMsgId]);

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
      setShowTranslateSubmenu(false);
      return;
    }
    setShowTranslateSubmenu(false);

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
      className={`msg-bubble-appear${isHighlighted ? " msg-row-highlight" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOwn ? "flex-end" : "flex-start",
        width: "100%",
        position: "relative",
        zIndex: !selectionMode && activeMenuMsgId === msg.id ? 20 : "auto",
        marginTop: topGap,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: isMobile ? "85%" : "min(78%, 560px)",
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
              color: reachedThreshold ? "var(--on-primary)" : colors.textSecondary,
              border: `1px solid ${reachedThreshold ? colors.accent : colors.borderStrong}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-sm)",
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
          className={[isHighlighted ? "msg-highlight" : "", msg.is_favorite ? "msg-important" : ""].filter(Boolean).join(" ") || undefined}
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
              ? "var(--primary-tint)"
              : isHighlighted
              ? undefined
              : msg.is_favorite
              ? (isOwn ? "var(--sent)" : "var(--received)")
              : (isOwn ? "var(--sent)" : "var(--received)"),
            border: isSelected
              ? `2px solid var(--primary)`
              : isHighlighted
              ? "none"
              : msg.is_favorite
              ? (isOwn ? "none" : "1px solid var(--border)")
              : isOwn
              ? "none"
              : `1px solid var(--border)`,
            borderRadius: isOwn ? "var(--r-lg) var(--r-lg) 6px var(--r-lg)" : "var(--r-lg) var(--r-lg) var(--r-lg) 6px",
            padding: "12px 16px",
            boxShadow: isSelected
              ? "var(--highlight-glow)"
              : isHighlighted
              ? undefined
              : msg.is_favorite
              ? "var(--shadow-sm)"
              : "var(--shadow-sm)",
            position: "relative",
            color: "var(--text)",
          }}
        >
          {/* Bubble Header: Sender Avatar & Name + More Actions Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, marginBottom: 4, position: "relative" }}>
            {selectionMode && (
              <ThemedCheckbox
                checked={Boolean(isSelected)}
                onChange={() => onToggleSelect && onToggleSelect(msg.id)}
                size={16}
                style={{ marginRight: 2 }}
                ariaLabel="Select message"
              />
            )}
            <Avatar
              src={isOwn ? me?.avatar_url : msg.from_avatar_url}
              name={isOwn ? (me?.display_name || "You") : msgSenderName}
              colorKey={msg.from_address}
              size={24}
              fontSize={11}
            />
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--link)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msgSenderName}
            </span>

            {/* Inline Translate / Revert Toggle Button */}
            {shouldShowInlineTranslate && !selectionMode && (
              <button
                type="button"
                className="chip-btn"
                onClick={handleToggleTranslate}
                disabled={isTranslating}
                style={{ flex: "none" }}
                title={isShowingTranslated ? (t("showOriginal") || "Show original") : `${t("translate") || "Translate"} (${getLanguageLabel(lang)})`}
                aria-label={isShowingTranslated ? (t("showOriginal") || "Show original") : (t("translate") || "Translate")}
              >
                <Languages size={12} strokeWidth={2} />
                <span>
                  {isTranslating
                    ? (t("translating") || "Translating…")
                    : isShowingTranslated
                    ? (t("showOriginal") || "Show original")
                    : (t("translate") || "Translate")}
                </span>
              </button>
            )}

            {/* More actions trigger button (kebab 36x36 with 44px tap target) */}
            {!selectionMode && (
              <button
                ref={triggerBtnRef}
                type="button"
                className="kebab-btn msg-actions-trigger"
                onClick={handleToggleMenu}
                style={{
                  flex: "none",
                  background: activeMenuMsgId === msg.id ? "var(--hover)" : "transparent",
                }}
                title={t("moreOptions") || "More options"}
                aria-label={t("moreOptions") || "More options"}
              >
                <MoreVertical size={16} strokeWidth={2} />
              </button>
            )}

            {/* Popover / Dropdown Menu (Vertical WhatsApp-style) via Portal */}
            {!selectionMode && activeMenuMsgId === msg.id && (
              <div
                ref={menuRef}
                className="msg-actions-menu themed-menu-scrollbar"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: menuPosition?.openUp ? "auto" : "calc(100% + 4px)",
                  bottom: menuPosition?.openUp ? "calc(100% + 4px)" : "auto",
                  maxHeight: menuPosition?.maxHeight, overflowY: "auto", right: menuPosition?.alignLeft ? "auto" : 0,
                  left: menuPosition?.alignLeft ? 0 : "auto",
                  minWidth: 220,
                  maxWidth: "min(280px, calc(100vw - 32px))",
                  padding: 6,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                  zIndex: 2500,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {deletingMsgId === msg.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 8px" }}>
                    <span style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
                      Delete message?
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => {
                          onDelete(msg);
                          setActiveMenuMsgId(null);
                          setDeletingMsgId(null);
                        }}
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          height: 36,
                          minHeight: 36,
                          background: "var(--danger-bg)",
                          color: "var(--danger)",
                          border: "1px solid var(--danger)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => setDeletingMsgId(null)}
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          height: 36,
                          minHeight: 36,
                          background: "var(--raised)",
                          color: "var(--text)",
                          border: "1px solid var(--border-strong)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <X size={14} strokeWidth={2} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 1. Reply */}
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        onReply(msg);
                        setActiveMenuMsgId(null);
                      }}
                      style={{ gap: 12 }}
                      title={t("replyDirectly") || "Reply"}
                      aria-label={t("replyDirectly") || "Reply"}
                    >
                      <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Reply size={18} strokeWidth={1.75} />
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>{t("replyDirectly") || "Reply"}</span>
                    </button>

                    {/* Reply Privately (group chats from others) */}
                    {isGroup && !isOwn && onReplyPrivately && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          onReplyPrivately(msg);
                          setActiveMenuMsgId(null);
                        }}
                        style={{ gap: 12 }}
                        title={t("replyPrivate") || "Reply privately in 1:1 chat"}
                        aria-label={t("replyPrivate") || "Reply privately in 1:1 chat"}
                      >
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Reply size={18} strokeWidth={1.75} style={{ transform: "scale(-1, 1)" }} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>{t("replyPrivate") || "Reply privately"}</span>
                      </button>
                    )}

                    {/* 2. Mark as important */}
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        onToggleFavorite(msg);
                        setActiveMenuMsgId(null);
                      }}
                      style={{ gap: 12 }}
                      title={msg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                      aria-label={msg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                    >
                      <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Star
                          size={18}
                          strokeWidth={1.75}
                          fill={msg.is_favorite ? "var(--important)" : "none"}
                          color={msg.is_favorite ? "var(--important)" : "var(--muted)"}
                        />
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>
                        {msg.is_favorite ? (t("unmarkImportant") || "Unstar") : (t("markImportant") || "Star")}
                      </span>
                    </button>

                    {/* 3. Read aloud */}
                    {isSpeechSynthesisSupported() && (
                      <button
                        type="button"
                        className={`menu-item ${speakingMsgId === msg.id ? "speaking-pulse" : ""}`}
                        onClick={() => {
                          onSpeak(msg, displayedBodyText);
                          setActiveMenuMsgId(null);
                        }}
                        style={{ gap: 12 }}
                        title={speakingMsgId === msg.id ? (t("stopReading") || "Stop reading") : (t("readAloud") || "Read aloud")}
                        aria-label={speakingMsgId === msg.id ? (t("stopReading") || "Stop reading") : (t("readAloud") || "Read aloud")}
                      >
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {speakingMsgId === msg.id ? (
                            <VolumeX size={18} strokeWidth={1.75} style={{ color: "var(--primary)" }} />
                          ) : (
                            <Volume2 size={18} strokeWidth={1.75} />
                          )}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>
                          {speakingMsgId === msg.id ? (t("stopReading") || "Stop reading") : (t("readAloud") || "Read aloud")}
                        </span>
                      </button>
                    )}

                    {/* 4. Translate to… */}
                    <div>
                      <button
                        type="button"
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTranslateSubmenu((prev) => !prev);
                        }}
                        disabled={isTranslating}
                        style={{ gap: 12 }}
                        title={t("translateTo") || "Translate to…"}
                        aria-label={t("translateTo") || "Translate to…"}
                      >
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Languages size={18} strokeWidth={1.75} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>
                          {isTranslating ? (t("translating") || "Translating…") : (t("translateTo") || "Translate to…")}
                        </span>
                        <ChevronDown
                          size={16}
                          strokeWidth={1.75}
                          style={{
                            marginLeft: "auto",
                            transform: showTranslateSubmenu ? "rotate(180deg)" : "none",
                            transition: "transform 150ms ease",
                            color: "var(--muted)",
                          }}
                        />
                      </button>

                      {showTranslateSubmenu && (
                        <div
                          className="themed-menu-scrollbar"
                          style={{
                            paddingLeft: 32,
                            maxHeight: 240,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          {supportedLanguages.map((l) => {
                            const isCurrentTarget = translation?.targetLang === l.code && !translation?.showOriginal;
                            return (
                              <button
                                key={l.code}
                                type="button"
                                className="menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTranslateTo(l.code);
                                }}
                                style={{
                                  height: 40,
                                  minHeight: 40,
                                  padding: "0 8px",
                                  fontSize: 14,
                                  justifyContent: "space-between",
                                  background: isCurrentTarget ? "var(--primary-tint)" : "transparent",
                                  color: isCurrentTarget ? "var(--link)" : "var(--text)",
                                  fontWeight: isCurrentTarget ? 600 : 400,
                                }}
                              >
                                <span>{l.label}</span>
                                {isCurrentTarget && <Check size={14} strokeWidth={2.5} color="var(--link)" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

                    {/* 5. Copy */}
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        onCopy(msg);
                        setTimeout(() => setActiveMenuMsgId(null), 300);
                      }}
                      style={{ gap: 12 }}
                      title={copiedMsgId === msg.id ? (t("copied") || "Copied") : (t("copy") || "Copy")}
                      aria-label={copiedMsgId === msg.id ? (t("copied") || "Copied") : (t("copy") || "Copy")}
                    >
                      <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {copiedMsgId === msg.id ? (
                          <Check size={18} strokeWidth={1.75} color="var(--success)" />
                        ) : (
                          <Copy size={18} strokeWidth={1.75} />
                        )}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>
                        {copiedMsgId === msg.id ? (t("copied") || "Copied!") : (t("copy") || "Copy")}
                      </span>
                    </button>

                    {/* Edit (own messages only) */}
                    {isOwn && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.body_text || "");
                          setActiveMenuMsgId(null);
                        }}
                        style={{ gap: 12 }}
                        title={t("edit") || "Edit"}
                        aria-label={t("edit") || "Edit"}
                      >
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <ComposeIcon size={18} strokeWidth={1.75} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>{t("edit") || "Edit"}</span>
                      </button>
                    )}

                    {/* Delete (own messages only) */}
                    {isOwn && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => setDeletingMsgId(msg.id)}
                        style={{ gap: 12, color: "var(--danger)" }}
                        title={t("delete") || "Delete"}
                        aria-label={t("delete") || "Delete"}
                      >
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Trash2 size={18} strokeWidth={1.75} color="var(--danger)" />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 500, textAlign: "left" }}>{t("delete") || "Delete"}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Subject on Root Message */}
          {!msg.in_reply_to && msg.subject && msg.subject.trim() && msg.subject !== "(no subject)" && !/^[\-\u2013\u2014\s]+$/.test(msg.subject) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: msg.subject && msg.subject.trim() && msg.subject !== "(no subject)" ? 700 : 400,
                color: "var(--muted)",
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
                    color: "var(--muted)",
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
                <div style={{ color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {referencedMsg?.body_text || referencedMsg?.subject || "(Referenced message)"}
                </div>
              </div>
            </div>
          )}

          {/* Message Body */}
          {editingMsgId === msg.id ? (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    const maxH = Math.round(window.innerHeight * 0.4);
                    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
                    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
                  }
                }}
                value={editingText}
                onChange={(e) => {
                  setEditingText(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  const maxH = Math.round(window.innerHeight * 0.4);
                  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
                  el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
                }}
                onInput={(e) => {
                  const el = e.target;
                  el.style.height = "auto";
                  const maxH = Math.round(window.innerHeight * 0.4);
                  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
                  el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
                }}
                onPaste={(e) => {
                  const el = e.target;
                  setTimeout(() => {
                    if (el) {
                      el.style.height = "auto";
                      const maxH = Math.round(window.innerHeight * 0.4);
                      el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
                      el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
                    }
                  }, 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSaveEdit(msg.id);
                  } else if (e.key === "Escape") {
                    setEditingMsgId(null);
                  }
                }}
                autoFocus
                rows={1}
                className="chat-scroll-container"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  borderRadius: 6,
                  border: `1px solid ${colors.accent}`,
                  background: colors.surface,
                  color: colors.textPrimary,
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  minHeight: 36,
                  maxHeight: "40vh",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSaveEdit(msg.id)}
                  disabled={!editingText.trim()}
                  style={{
                    background: colors.accent,
                    color: "var(--on-primary)",
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
                    background: "var(--raised)",
                    color: "var(--danger)",
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
            <div>
              <div style={{ fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                {searchQuery ? highlightText(displayedBodyText, searchQuery) : displayedBodyText}
              </div>

              {/* Requirement 2: Small, subtle caption at the bottom of the translated bubble */}
              {isShowingTranslated && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    opacity: 0.65,
                    fontStyle: "italic",
                    marginTop: 4,
                    userSelect: "none",
                  }}
                >
                  {t("translatedCaption") || "Translated message"}
                </div>
              )}
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
                      background: "var(--raised)",
                      borderRadius: "var(--r-md)",
                      border: `1px solid ${colors.border}`,
                      fontSize: 12,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <Paperclip size={14} strokeWidth={2} color={colors.textSecondary} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {fname}
                    </span>
                    {att.size && <span style={{ color: "var(--muted)", flexShrink: 0 }}>{formatBytes(att.size)}</span>}
                    {att.id && isPreviewable && onPreviewAttachment && (
                      <button
                        type="button"
                        onClick={() => onPreviewAttachment({
                          id: att.id,
                          url: `${BASE_URL}/mail/attachments/${att.id}?token=${encodeURIComponent(localStorage.getItem("phonemail_token") || "")}`,
                          filename: fname,
                          type: isImg ? "image" : "pdf",
                        })}
                        style={{
                          background: colors.accentLight,
                          border: "1px solid var(--border-strong)",
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
                background: "var(--raised)",
                border: `1px solid ${colors.border}`,
                color: "var(--muted)",
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
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {Boolean(msg.edited_at) && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
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
  onThreadUpdated,
  onBack,
  scrollToMessageId,
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const isMobile = useIsMobile(768);
  const isNarrow = useIsMobile(1023);

  const navigate = useNavigate();

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen]     = useState(false);
  const [contactProfile, setContactProfile]     = useState(null);
  const [contactLoading, setContactLoading]     = useState(false);

  const [readAloudLang, setReadAloudLang] = useState(() => {
    const defaultSpeechCode = VOICE_LANGUAGES.find((l) => l.code.startsWith(lang))?.code || "en-IN";
    return getSavedReadAloudLang(defaultSpeechCode);
  });
  const [readAloudMenuMsgId, setReadAloudMenuMsgId] = useState(null);
  const [voiceWarning, setVoiceWarning] = useState({ msgId: null, text: "" });

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const scrolledRef = useRef(null); const prevMsgCountRef = useRef(0); const pendingTargetRef = useRef(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // message object being replied to
  const hasMyReply = (m) => Boolean(m) && messages.some((x) => x.in_reply_to && (x.in_reply_to === m.message_id || x.in_reply_to === m.id) && x.from_address === me?.email_address);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(""); const [replyNotice, setReplyNotice] = useState(false); useEffect(() => { if (!replyNotice) return undefined; const id = setTimeout(() => setReplyNotice(false), 2500); return () => clearTimeout(id); }, [replyNotice]);

  // ── Phase 3: Chat Wallpaper (from localStorage, key "chatWallpaper") ─────
  const [chatWallpaper, setChatWallpaper] = useState(() => {
    try { return localStorage.getItem("chatWallpaper") === "none" ? "none" : "doodle"; } catch { return "doodle"; }
  });

  // Listen for wallpaper changes from Settings picker (storage event from same page)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "chatWallpaper") {
        try { setChatWallpaper(e.newValue === "none" ? "none" : "doodle"); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [wpTheme, setWpTheme] = useState(() => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"));
  const [wpFiles, setWpFiles] = useState(null);
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setWpTheme(el.getAttribute("data-theme") === "dark" ? "dark" : "light"));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    fetch("/assets/wallpapers/manifest.json").then((r) => r.json()).then((d) => {
      const e = Array.isArray(d) ? d.find((x) => x.id === "doodle") : null;
      if (e) setWpFiles(e);
    }).catch(() => {});
  }, []);
  const wallpaperUrl = chatWallpaper === "none" || !wpFiles ? null : (wpTheme === "dark" ? (wpFiles.fileDark || wpFiles.file) : wpFiles.file);
  // Allow Settings (same tab) to push updates via a CustomEvent
  useEffect(() => {
    const onWpChange = (e) => {
      try { setChatWallpaper(e.detail === "none" ? "none" : "doodle"); } catch {}
    };
    window.addEventListener("chatWallpaperChange", onWpChange);
    return () => window.removeEventListener("chatWallpaperChange", onWpChange);
  }, []);



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

  const adjustInputHeight = useCallback(() => {
    const el = textInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24; // 16px font * 1.4-1.5
    const maxHeight = lineHeight * 5; // grows to at most 5 lines
    const minHeight = 24; // one line at rest
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(minHeight, newHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustInputHeight();
  }, [text, adjustInputHeight]);

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

  // ── Translation Disclaimer Notice State ─────────────────────────────────
  const [translationNoticeVisible, setTranslationNoticeVisible] = useState(false);
  const [translationNoticeKind, setTranslationNoticeKind] = useState("info");
  const translationNoticeTimerRef = useRef(null);

  // kind: "info" (accuracy disclaimer) | "same" (already in that language) | "error"
  const handleTranslationTriggered = useCallback((kind = "info") => {
    if (translationNoticeTimerRef.current) {
      clearTimeout(translationNoticeTimerRef.current);
    }
    setTranslationNoticeKind(kind);
    setTranslationNoticeVisible(true);
    translationNoticeTimerRef.current = setTimeout(() => {
      setTranslationNoticeVisible(false);
      translationNoticeTimerRef.current = null;
    }, kind === "info" ? 5000 : 6500);
  }, []);

  useEffect(() => {
    return () => {
      if (translationNoticeTimerRef.current) {
        clearTimeout(translationNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (translationNoticeTimerRef.current) {
      clearTimeout(translationNoticeTimerRef.current);
      translationNoticeTimerRef.current = null;
    }
    setTranslationNoticeVisible(false);
  }, [thread?.id]);

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
  const [showPlusPopover, setShowPlusPopover] = useState(false);
  const plusBtnRef = useRef(null);

  useEffect(() => {
    if (!showPlusPopover) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShowPlusPopover(false);
    };
    const handleClickOutside = (e) => {
      const plusWrap = plusBtnRef.current && plusBtnRef.current.parentElement; if (plusWrap && !plusWrap.contains(e.target)) {
        setShowPlusPopover(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [showPlusPopover]);
  const [assisting, setAssisting] = useState(false);

  // Fetch messages when thread changes
  const loadMessages = async () => {
    if (!thread?.id) return;
    setLoading(true);
    try {
      const { data } = await getThreadMessages(thread.id, { folder: folder === "important" ? "home" : folder });
      setMessages(data);
      const firstMsg = data && data.length > 0 ? data[0] : null;
      if (firstMsg?.body_text) {
        setSubject((curr) => {
          if (!curr) return "";
          if (!isActualSubjectValue(curr, thread?.body_text, thread?.last_message, firstMsg.body_text)) {
            return "";
          }
          return curr;
        });
      }
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
    setSubject("");
    scrolledRef.current = null; pendingTargetRef.current = null;
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
    if (scrollToMessageId || thread?.scrollToMessageId) pendingTargetRef.current = scrollToMessageId || thread?.scrollToMessageId; const targetId = pendingTargetRef.current;
    if (targetId) {
      prevMsgCountRef.current = messages.length; if (scrolledRef.current === targetId || loading || messages.length === 0) return;
      const timer = setTimeout(() => {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedMsgId(targetId);
          scrolledRef.current = targetId; pendingTargetRef.current = null;
          setTimeout(() => {
            setHighlightedMsgId(null);
          }, 2500);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (messages.length === prevMsgCountRef.current) return; prevMsgCountRef.current = messages.length; const sc = messagesEndRef.current?.closest(".chat-messages-scroll"); if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
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
      }, 2500);
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

  const handleSpeakMessage = (msg, textOverride) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }
    const textToSpeak = (textOverride || msg.body_text || msg.subject || "").trim();
    if (!textToSpeak) return;

    // Auto-detect the script language from currently displayed text
    const detectedLangCode = detectScriptLanguage(textToSpeak, lang);
    const targetVoiceLang = getVoiceLangForCode(detectedLangCode);

    speakText(textToSpeak, targetVoiceLang, {
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
      if (data.body) {
        setText(data.body);
        if (data.subject && !subject && isActualSubjectValue(data.subject, data.body, thread?.body_text, thread?.last_message)) {
          setSubject(data.subject.trim());
        }
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
    setMessages((prev) => [...prev, optimisticMsg]); setSubject("");

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
          color: "var(--muted)",
          background: colors.surface,
          gap: 12,
        }}
      >
      <div style={{ fontSize: 48, color: "var(--muted)", display: "flex", justifyContent: "center" }}>
          <MessageCircle size={52} strokeWidth={1.2} color="var(--link)" />
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

  const handleContactHeaderClick = async () => {
    if (isGroup) {
      setGroupModalOpen(true);
      return;
    }
    const counterpart = thread?.counterpart || "";
    if (
      counterpart &&
      me?.email_address &&
      counterpart.toLowerCase() === me.email_address.toLowerCase()
    ) {
      navigate("/settings/profile");
      return;
    }

    setContactModalOpen(true);
    setContactLoading(true);
    try {
      const cleanPhone = (thread?.counterpart_phone || counterpart || "").split("@")[0].replace(/\D/g, "");
      const { data } = await lookupPhone(cleanPhone || counterpart);
      setContactProfile(data?.user || data);
    } catch {
      setContactProfile({
        display_name: headerDisplayName,
        phone: (thread?.counterpart_phone || counterpart || "").split("@")[0],
        email_address: counterpart,
      });
    } finally {
      setContactLoading(false);
    }
  };

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
          height: 68, position: "relative",
          boxSizing: "border-box",
          padding: isMobile ? "0 14px" : "0 20px",
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          zIndex: 10,
          flexShrink: 0,
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
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title={t("cancelSelection") || "Cancel selection"}
                aria-label={t("cancelSelection") || "Cancel selection"}
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
                className="btn-text"
                onClick={handleBulkStarSelected}
                disabled={selectedMsgIds.size === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  background: "var(--raised)",
                  color: colors.textPrimary,
                  cursor: selectedMsgIds.size > 0 ? "pointer" : "default",
                  opacity: selectedMsgIds.size > 0 ? 1 : 0.5,
                  fontSize: 13,
                  fontWeight: 600,
                }}
                title="Star / unstar selected"
                aria-label="Star / unstar selected"
              >
                <Star size={16} strokeWidth={2} color="var(--important)" />
                <span>Star</span>
              </button>

              <button
                type="button"
                className="btn-text icon-btn-danger"
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
                    padding: 8,
                    minWidth: 48,
                    minHeight: 48,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--r-md)",
                  }}
                  title={t("backToConversations") || "Back to conversations"}
                  aria-label={t("backToConversations") || "Back to conversations"}
                >
                  <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              <div
                onClick={handleContactHeaderClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 0,
                  cursor: "pointer",
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleContactHeaderClick(); }}
                title="View profile"
              >
                <Avatar
                  src={thread.avatar_url}
                  name={headerDisplayName}
                  colorKey={thread.counterpart || thread.group_name}
                  isGroup={isGroup}
                  size={40}
                  fontSize={16}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                    {isGroup && <Users size={15} strokeWidth={2} color={colors.textSecondary} />}
                    {headerDisplayName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isGroup
                      ? `Group · ${(thread.participants || []).length} participants`
                      : (thread.counterpart_phone ? formatPhoneNumber(thread.counterpart_phone) : thread.counterpart)}
                  </div>
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
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={t("moveToTrash") || "Move to trash"}
                  aria-label={t("moveToTrash") || "Move to trash"}
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
            background: "var(--raised)",
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
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 13,
              color: colors.textPrimary,
              outline: "none",
            }}
          />
          {searchQuery.trim() && (
            <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
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
              title={t("previousMatch") || "Previous match"}
              aria-label={t("previousMatch") || "Previous match"}
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
              title={t("nextMatch") || "Next match"}
              aria-label={t("nextMatch") || "Next match"}
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
                color: "var(--danger)",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                marginLeft: 4,
              }}
              title={t("closeSearch") || "Close search"}
              aria-label={t("closeSearch") || "Close search"}
            >
              <X size={16} strokeWidth={2} color={colors.danger} />
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable Chat Bubble Stream (with Wallpaper Layer) ─────────────── */}
      <div className="chat-messages-wrapper" style={wallpaperUrl ? { backgroundImage: `url("${wallpaperUrl}")`, backgroundSize: `${Math.round(2560 / (window.devicePixelRatio || 1))}px ${Math.round(1440 / (window.devicePixelRatio || 1))}px`, backgroundRepeat: "no-repeat", backgroundPosition: "center" } : undefined}>
        {/* Wallpaper background — renders only when a wallpaper file is selected */}


        <div
          className="chat-scroll-container chat-messages-scroll"
          onScroll={handleMessagesScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "16px 12px 200px" : "20px 20px 200px",
          }}
        >
          <div
            style={{
              maxWidth: 860,
              width: "100%",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              minHeight: "100%",
              justifyContent: messages.length === 0 ? "center" : "flex-start",
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
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isSameGroup = prevMsg && prevMsg.from_address === msg.from_address;
            const topGap = isSameGroup ? 6 : 14;

            const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
            const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at).toDateString() : null;
            const showDateSeparator = Boolean(msgDate && msgDate !== prevDate);
            const dateLabel = msg.created_at ? new Date(msg.created_at).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              ...(new Date(msg.created_at).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {})
            }) : "";

            return (
              <React.Fragment key={msg.id || index}>
                {showDateSeparator && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
                    <span
                      style={{
                        background: "var(--raised)",
                        borderRadius: 999,
                        fontSize: 12,
                        color: "var(--muted)",
                        padding: "4px 12px",
                        fontWeight: 500,
                        userSelect: "none",
                      }}
                    >
                      {dateLabel}
                    </span>
                  </div>
                )}
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
                onReply={(m) => { if (hasMyReply(m)) { setReplyNotice(true); return; }
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
                onTranslationTriggered={handleTranslationTriggered}
                topGap={showDateSeparator ? 6 : topGap}
                searchQuery={searchQuery}
                />
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* ── Bottom Floating Compose Bar (WhatsApp Style) ────────────────────── */}
      <div
        style={{
          background: "transparent",
          padding: 0,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* Requirement 3: One-time dismissible translation disclaimer notice */}
        <div style={{ position: "relative", height: 0, width: "100%", maxWidth: 860, margin: "0 auto", pointerEvents: "none" }}>{(
          <div
            role="status"
            aria-live="polite"
            style={{
              maxWidth: 860,
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", margin: 0, zIndex: 5, opacity: translationNoticeVisible ? 1 : 0, visibility: translationNoticeVisible ? "visible" : "hidden", pointerEvents: translationNoticeVisible ? "auto" : "none", transition: translationNoticeVisible ? "opacity 200ms ease" : "opacity 200ms ease, visibility 0s linear 200ms",
              width: "calc(100% - 24px)",
              boxSizing: "border-box",
              padding: "6px 12px",
              borderRadius: 8,
              background: "var(--raised)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 11,
              color: "var(--muted)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <Globe size={13} style={{ flexShrink: 0, color: translationNoticeKind === "error" ? "var(--danger)" : "var(--primary)", opacity: 0.85 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                {translationNoticeKind === "error"
                  ? t("translationFailed")
                  : translationNoticeKind === "same"
                  ? t("translationSameLang")
                  : t("translationDisclaimer")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (translationNoticeTimerRef.current) {
                  clearTimeout(translationNoticeTimerRef.current);
                  translationNoticeTimerRef.current = null;
                }
                setTranslationNoticeVisible(false);
              }}
              style={{
                background: "none",
                border: "none",
                padding: "2px",
                cursor: "pointer",
                color: "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                flexShrink: 0,
              }}
              title={t("dismiss") || "Dismiss"}
              aria-label={t("dismiss") || "Dismiss"}
            >
              <X size={13} />
            </button>
          </div>
        )}

        </div>{/* ONE rounded container for the composer (C1 & C2) */}
        <div
          className="chat-composer-container"
          style={{
            background: "var(--surface)",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border-strong)",
            margin: "8px 12px",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            boxShadow: "var(--shadow-sm)",
            maxWidth: 860,
            width: "calc(100% - 24px)",
            alignSelf: "center",
            pointerEvents: "auto",
            position: "relative",
            top: 0,
          }}
        >
          {(
            <div role="status" aria-hidden={!replyNotice} style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8, zIndex: 5, whiteSpace: "nowrap", maxWidth: "calc(100vw - 48px)", overflow: "hidden", textOverflow: "ellipsis", padding: "6px 12px", background: "var(--raised)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-sm)", fontSize: 12, pointerEvents: "none", opacity: replyNotice ? 1 : 0, transition: "opacity 200ms ease" }}>
              {t("alreadyReplied")}
            </div>
          )}
          {error && (
            <div style={{ padding: "4px 10px", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 6, fontSize: 12, margin: "4px 8px" }}>
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
                padding: "6px 12px",
                background: "var(--raised)",
                borderBottom: "1px solid var(--border)",
                borderLeft: "3px solid var(--primary)",
                fontSize: 12,
              }}
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <span style={{ fontWeight: 700, color: "var(--link)" }}>
                  Replying to{" "}
                  {replyingTo.from_name || replyingTo.from_display || formatPhoneNumber(replyingTo.from_address || "User")}
                  :{" "}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {replyingTo.body_text || replyingTo.subject || "Message"}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => setReplyingTo(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px", display: "flex", alignItems: "center" }}
                title={t("cancelReply") || "Cancel reply"}
                aria-label={t("cancelReply") || "Cancel reply"}
              >
                <X size={14} color="var(--danger)" />
              </button>
            </div>
          )}

          {/* C2: Optional subject row inside container: plain borderless 40px input, 15px font, 1px --border divider under it */}
          {!replyingTo && (
            <div
              style={{
                height: 40,
                minHeight: 40,
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                padding: "0 12px",
                boxSizing: "border-box",
              }}
            >
              <input
                type="text"
                placeholder={t("subjectOptional") || "Subject (optional)"}
                value={subject}
                onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && text.trim()) { e.preventDefault(); handleSend(); } }}
                style={{
                  width: "100%",
                  height: 40,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  color: "var(--text)",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {/* Attachment Chips */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 12px 0" }}>
              {attachments.map((att, i) => (
                <div
                  key={att.id || i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--raised)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                >
                  <Paperclip size={12} strokeWidth={2} color="var(--muted)" />
                  <span>{att.filename || "file"}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => removeAttachment(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px", display: "flex", alignItems: "center" }}
                    title={t("removeAttachment") || "Remove attachment"}
                    aria-label={t("removeAttachment") || "Remove attachment"}
                  >
                    <X size={12} strokeWidth={2} color="var(--danger)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AI Assist Intent Chips Drawer */}
          {showAssist && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 12px", borderBottom: "1px solid var(--border)" }}>
              {ASSIST_INTENT_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={assisting}
                  onClick={() => handleAssist(chip.intent)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--raised)",
                    color: "var(--text)",
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

          {/* C2: Main input row (min-height 48px) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isNarrow ? 4 : 8,
              minHeight: 48,
              padding: "2px 8px",
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            {/* Hidden File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            {/* Desktop: Attach button */}
            {!isNarrow && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="icon-btn"
                title={t("attachFile")}
                aria-label={t("attachFile")}
                style={{ color: "var(--muted)" }}
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>
            )}

            {isNarrow ? (
              <>
                {/* Mobile: "+" popover button */}
                <div style={{ position: "relative" }}>
                  <button
                    ref={plusBtnRef}
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPlusPopover((prev) => !prev)}
                    style={{
                      color: "var(--muted)",
                      background: showPlusPopover ? "var(--hover)" : "transparent",
                    }}
                    title={t("moreOptions") || "More options"}
                    aria-label={t("moreOptions") || "More options"}
                    aria-expanded={showPlusPopover}
                  >
                    <Plus size={18} strokeWidth={2} />
                  </button>

                  {showPlusPopover && (
                    <div
                      className="themed-menu-scrollbar"
                      style={{
                        position: "absolute",
                        bottom: 50,
                        left: 0,
                        background: "var(--surface)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: "var(--r-md)",
                        boxShadow: "var(--shadow-sm)",
                        padding: "6px",
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 180,
                        zIndex: 2500,
                      }}
                    >
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowPlusPopover(false);
                        }}
                      >
                        <Paperclip size={16} strokeWidth={2} style={{ color: "var(--primary)" }} />
                        <span>{t("attachFile") || "Attach file"}</span>
                      </button>

                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setShowAssist(!showAssist);
                          setShowPlusPopover(false);
                        }}
                      >
                        <Sparkles size={16} strokeWidth={2} style={{ color: "var(--primary)" }} />
                        <span>{t("aiDraftAssistant") || "AI Assistant"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile: ComposeIcon button (44px round icon-btn) */}
                {onOpenTraditionalCompose && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onOpenTraditionalCompose(thread, null, { body: text, subject: subject })}
                    title={t("openFormalComposer")}
                    aria-label={t("openFormalComposer")}
                    style={{ color: "var(--muted)" }}
                  >
                    <ComposeIcon size={18} strokeWidth={2} />
                  </button>
                )}
              </>
            ) : (
              /* Desktop: show AI assist directly */
              <button
                type="button"
                onClick={() => setShowAssist(!showAssist)}
                className="icon-btn"
                style={{
                  background: showAssist ? "var(--primary-tint)" : "transparent",
                  color: showAssist ? "var(--link)" : "var(--muted)",
                }}
                title={t("aiDraftAssistant")}
                aria-label={t("aiDraftAssistant")}
              >
                <Sparkles size={17} strokeWidth={2} />
              </button>
            )}

            {/* C3: Message Input: flex:1; min-width:0; font-size:16px; rows=1 */}
            <textarea
              ref={textInputRef}
              placeholder={isListening ? t("typeMessageListening") : t("typeMessage")}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                adjustInputHeight();
              }}
              onInput={adjustInputHeight}
              onPaste={() => {
                setTimeout(adjustInputHeight, 0);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              className="chat-scroll-container"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "8px 6px",
                borderRadius: 0,
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontSize: 16,
                resize: "none",
                outline: "none",
                minHeight: 24,
                lineHeight: 1.4,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {/* Desktop: Compose in traditional (letter) view */}
            {!isNarrow && onOpenTraditionalCompose && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => onOpenTraditionalCompose(thread, null, { body: text, subject: subject })}
                title={t("openFormalComposer")}
                aria-label={t("openFormalComposer")}
                style={{ color: "var(--muted)" }}
              >
                <ComposeIcon size={18} strokeWidth={2} />
              </button>
            )}

            {/* C5: At <=768px: ONE trailing action (mic when empty, send when text exists) */}
            {isMobile ? (
              Boolean(text.trim() || attachments.length > 0) ? (
                <button
                  type="button"
                  onClick={handleSend}
                  className="icon-btn"
                  style={{
                    background: "var(--primary)",
                    color: "var(--on-primary)",
                    cursor: "pointer",
                  }}
                  title={t("sendMessage")}
                  aria-label={t("sendMessage")}
                >
                  <Send size={18} strokeWidth={2} />
                </button>
              ) : (
                isSpeechRecognitionSupported() && (
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
                      className="icon-btn"
                      style={{
                        background: isListening ? "var(--primary-tint)" : "transparent",
                        color: isListening ? "var(--primary)" : "var(--muted)",
                      }}
                      title={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}
                      aria-label={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}
                    >
                      {isListening ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
                    </button>
                  </VoiceLanguageMenu>
                )
              )
            ) : (
              /* Desktop: show both Mic and Send */
              <>
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
                      className="icon-btn"
                      style={{
                        background: isListening ? "var(--primary-tint)" : "transparent",
                        color: isListening ? "var(--primary)" : "var(--muted)",
                      }}
                      title={isListening ? "Stop listening" : t("voiceToText")}
                      aria-label={isListening ? "Stop listening" : t("voiceToText")}
                    >
                      {isListening ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
                    </button>
                  </VoiceLanguageMenu>
                )}

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!text.trim() && attachments.length === 0}
                  className="icon-btn"
                  style={{
                    background: (text.trim() || attachments.length > 0) ? "var(--primary)" : "transparent",
                    color: (text.trim() || attachments.length > 0) ? "var(--on-primary)" : "var(--muted)",
                    cursor: (text.trim() || attachments.length > 0) ? "pointer" : "default",
                    opacity: (text.trim() || attachments.length > 0) ? 1 : 0.4,
                  }}
                  title={t("sendMessage")}
                  aria-label={t("sendMessage")}
                >
                  <Send size={18} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Bracket placeholder resolver pills */}
          <PlaceholderResolverBar text={text} onChange={setText} />
        </div>

        {/* C4: Press Enter hint (12px muted, pointer: fine only) */}
        <div className="press-enter-hint">
          {t("pressEnterHint") || "Press Enter to send"}
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
            background: "var(--scrim)",
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
              border: "1px solid var(--border-strong)",
              borderRadius: 16,
              boxShadow: "var(--shadow-sm)",
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
                background: "var(--raised)",
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
                    <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500, whiteSpace: "nowrap" }}>
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
                        background: "var(--danger-bg)",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        color: "var(--danger)",
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
                        background: "var(--raised)",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        color: "var(--danger)",
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
                        if (hasMyReply(formalOverlayMsg)) setReplyNotice(true); else setReplyingTo(formalOverlayMsg);
                        handleCloseFormalOverlay();
                        setTimeout(() => textInputRef.current?.focus(), 80);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: 6,
                        color: "var(--muted)",
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
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={t("replyPrivate") || "Reply privately in 1:1 chat"}
                        aria-label={t("replyPrivate") || "Reply privately in 1:1 chat"}
                      >
                        <Reply size={16} strokeWidth={2} style={{ transform: "scale(-1, 1)" }} />
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
                        color: formalOverlayMsg.is_favorite ? "var(--important)" : colors.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={formalOverlayMsg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                      aria-label={formalOverlayMsg.is_favorite ? t("unmarkImportant") : t("markImportant")}
                    >
                      <Star size={16} strokeWidth={2} fill={formalOverlayMsg.is_favorite ? "var(--important)" : "none"} />
                    </button>

                    {/* Read Aloud (TTS) with auto language detection and animated equalizer */}
                    {isSpeechSynthesisSupported() && (
                      <button
                        type="button"
                        className={`icon-btn ${speakingMsgId === formalOverlayMsg.id ? "speaking-pulse" : ""}`}
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
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2.5,
                              height: 16,
                              width: 16,
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          >
                            <span className="wave-bar-1" style={{ width: 2.5, minHeight: 6, background: colors.accent, borderRadius: 1.5, display: "inline-block" }} />
                            <span className="wave-bar-2" style={{ width: 2.5, minHeight: 6, background: colors.accent, borderRadius: 1.5, display: "inline-block" }} />
                            <span className="wave-bar-3" style={{ width: 2.5, minHeight: 6, background: colors.accent, borderRadius: 1.5, display: "inline-block" }} />
                          </div>
                        ) : (
                          <Volume2 size={16} strokeWidth={2} />
                        )}
                      </button>
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
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <ComposeIcon size={16} strokeWidth={2} />
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
                          color: "var(--muted)",
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
                        color: "var(--danger)",
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
                    background: "var(--raised)",
                    border: `1px solid ${colors.border}`,
                    color: "var(--muted)",
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
                      color: "var(--muted)",
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
                  background: "var(--raised)",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Avatar
                  src={formalOverlayMsg.from_avatar_url}
                  name={formalSenderName}
                  colorKey={formalOverlayMsg.from_address}
                  size={38}
                  fontSize={15}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                      {formalSenderName}
                      <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6, fontSize: 13 }}>
                        &lt;{formalOverlayMsg.from_address}&gt;
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>
                      {formalFormattedDate}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
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
                  <div style={{ color: "var(--muted)", whiteSpace: "pre-wrap" }}>
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
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
                      const inlineUrl = att.id ? `${BASE_URL}/mail/attachments/${att.id}?token=${encodeURIComponent(localStorage.getItem("phonemail_token") || "")}` : att.url;

                      return (
                        <div
                          key={att.id || attIdx}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: 10,
                            background: "var(--raised)",
                            overflow: "hidden",
                          }}
                        >
                          {isImg && inlineUrl && (
                            <div style={{ background: "var(--raised)", padding: 10, display: "flex", justifyContent: "center" }}>
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
                                <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
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
                                    border: "1px solid var(--border-strong)",
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
                                    border: "1px solid var(--border-strong)",
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
      {previewAttachment && typeof document !== "undefined" && createPortal(<div onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            backdropFilter: "blur(4px)",
            zIndex: 9000, boxSizing: "border-box", overflow: "hidden",
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
              maxWidth: previewAttachment.type === "pdf" ? 920 : "90vw", flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 12, ...(previewAttachment.type === "pdf" ? { position: "fixed", top: 112, right: 16, width: "auto", maxWidth: "40vw", marginBottom: 0, zIndex: 9100, flexDirection: "column", alignItems: "flex-end" } : {}),
            }}
          >
            <span
              style={{
                color: "var(--on-primary)",
                fontSize: 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: "none",
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
                  background: "var(--primary)",
                  border: "1px solid var(--primary)",
                  color: "var(--on-primary)",
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
                  background: "var(--overlay)",
                  border: "1px solid var(--border)",
                  color: "var(--danger)",
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
            onClick={(e) => { if (e.target === e.currentTarget) setPreviewAttachment(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "100%",
              maxHeight: "100%", minHeight: 0, ...(previewAttachment.type === "pdf" ? { flex: 1, width: "100%" } : {}), ...(previewAttachment.type === "image" ? { padding: 12, background: "var(--overlay)", border: "1px solid var(--border)", borderRadius: 12, backdropFilter: "blur(6px)" } : {}),
            }}
          >
            {previewAttachment.type === "image" ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.filename}
                style={{
                  maxWidth: "90vw",
                  maxHeight: "74vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-sm)",
                }}
              />
            ) : previewAttachment.type === "pdf" ? (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.filename}
                style={{
                  width: "90vw",
                  maxWidth: 920,
                  height: "100%",
                  border: "none",
                  borderRadius: 8,
                  background: "var(--surface)",
                  boxShadow: "var(--shadow-sm)",
                }}
              />
            ) : null}
          </div>
        </div>, document.body)}

      {/* Contact Profile Modal (Item 8) */}
      {contactModalOpen && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          className="formal-overlay-backdrop"
          onClick={() => setContactModalOpen(false)}
        >
          <div
            className="formal-overlay-card"
            style={{
              background: colors.surface,
              borderRadius: 16,
              border: `1px solid ${colors.border}`,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contactLoading ? (
              <div style={{ textAlign: "center", padding: 30, color: colors.textSecondary }}>
                Loading profile…
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <Avatar
                    src={contactProfile?.avatar_url || thread.avatar_url}
                    name={contactProfile?.display_name || headerDisplayName}
                    colorKey={thread.counterpart || thread.group_name}
                    size={64}
                    fontSize={24}
                  />
                  <div style={{ textAlign: "center" }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, color: colors.textPrimary }}>
                      {contactProfile?.display_name || headerDisplayName}
                    </h3>
                    {Boolean(contactProfile?.phone) && (
                      <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                        {formatPhoneNumber(contactProfile.phone)}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                    borderBottom: `1px solid ${colors.border}`,
                    padding: "12px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span style={{ color: "var(--muted)", fontWeight: 500 }}>Email:</span>
                    <span style={{ color: colors.textPrimary, wordBreak: "break-all" }}>
                      {contactProfile?.email_address || thread?.counterpart || "No email"}
                    </span>
                  </div>

                  {Array.isArray(contactProfile?.aliases) && contactProfile.aliases.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
                        Aliases:
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {contactProfile.aliases.map((al) => (
                          <span
                            key={al}
                            style={{
                              background: "var(--raised)",
                              border: `1px solid ${colors.border}`,
                              borderRadius: 12,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: colors.textAccent,
                            }}
                          >
                            @{al}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  style={{
                    background: colors.accent,
                    color: "var(--on-primary)",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    alignSelf: "center",
                    width: "100%",
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {groupModalOpen && (
        <GroupInfoModal
          thread={thread}
          me={me}
          onClose={() => setGroupModalOpen(false)}
          onUpdated={(patch) => onThreadUpdated && onThreadUpdated(thread.id, patch)}
        />
      )}
    </div>
  );
}
