
const FOLDER_EMPTY_CONFIG = {
  home: { icon: MessageCircle, titleKey: "welcomeTitle", bodyKey: "emptyHomeBody" },
  important: { icon: Star, titleKey: "emptyImportantTitle", bodyKey: "emptyImportantBody" },
  drafts: { icon: FileText, titleKey: "emptyDraftsTitle", bodyKey: "emptyDraftsBody" },
  spam: { icon: ShieldAlert, titleKey: "emptySpamTitle", bodyKey: "emptySpamBody" },
  trash: { icon: Trash2, titleKey: "emptyTrashTitle", bodyKey: "emptyTrashBody" },
};
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Logo from "../components/Logo.jsx";
import FilterChips from "../components/FilterChips.jsx";
import ThreadList from "../components/ThreadList.jsx";
import ChatView from "../components/ChatView.jsx";
import ImportantList from "../components/ImportantList.jsx";
import DraftsList from "../components/DraftsList.jsx";
import ComposeModal from "../components/ComposeModal.jsx";
import ChangePassword from "./ChangePassword.jsx";
import {
  getMe,
  getThreads,
  getEmails,
  sendMail,
  updateEmail,
  deleteEmail,
  updateThread,
  deleteThread,
  lookupPhone,
  getImportantMessages,
  getDrafts,
  saveDraft,
  deleteDraft,
} from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { Trash2, X, RotateCcw, MessageCircle, Star, FileText, ShieldAlert } from "lucide-react";
const delGate = { ok: false };
import EmptyState from "../components/EmptyState.jsx";
import ComposeIcon from "../components/ComposeIcon.jsx";

const OFFLINE_QUEUE_KEY = "phonemail_offline_queue";

// On phones an open chat is full-screen and covers the top bar (search / menu / profile).
// Flip this to true to also hide the top bar while a chat is open on desktop.
// (Note: the folders menu button lives in the top bar, so on desktop you'd lose it inside a chat.)
const HIDE_TOPBAR_IN_CHAT_ON_DESKTOP = false;

const CHAT_EXIT_MS = 240;
const COMPOSE_EXIT_MS = 180;

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); }
  catch { return []; }
}

function setOfflineQueue(queue) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export default function Mail() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isMobile = useIsMobile(768);
  const isNarrow  = useIsMobile(1023); // false when viewport >= 1024px (desktop canvas)

  const [me, setMe] = useState(null);
  const [folder, setFolder] = useState("home"); // "home" | "spam" | "trash"
  const [filter, setFilter] = useState("all");   // "all" | "unread" | "attachments" | "favorites" (Important)
  const [query, setQuery] = useState("");

  const [threads, setThreads] = useState([]);
  const [emails, setEmails] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Live badge counts for Important and Trash
  const [importantCount, setImportantCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  useEffect(() => {
    getDrafts().then(({ data }) => setDrafts(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // Trash multi-select state
  const [trashSelectionMode, setTrashSelectionMode] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState(new Set());
  const [listSelBar, setListSelBar] = useState(null);
  const [delAsk, setDelAsk] = useState(null);

  // On wide/desktop, sidebar starts open (persistent column). On narrow/mobile, it starts closed (off-canvas).
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 768 : true
  );

  // Sync sidebar open state when crossing the mobile/desktop breakpoint
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (e) => {
      setSidebarOpen(!e.matches);
    };
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  // â”€â”€ Section 4: Edge-swipe from left ~24px to open drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isTracking = false;

    const handleStart = (clientX, clientY) => {
      if (clientX <= 24) {
        startX = clientX;
        startY = clientY;
        isTracking = true;
      }
    };

    const handleMove = (clientX, clientY) => {
      if (!isTracking) return;
      const deltaX = clientX - startX;
      const deltaY = Math.abs(clientY - startY);
      if (deltaY > Math.abs(deltaX)) {
        isTracking = false;
        return;
      }
      if (deltaX > 35) {
        setSidebarOpen(true);
        isTracking = false;
      }
    };

    const handleEnd = () => {
      isTracking = false;
    };

    const onTouchStart = (e) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = handleEnd;

    const onPointerDown = (e) => {
      if (e.pointerType === "touch" || e.clientX <= 24) {
        handleStart(e.clientX, e.clientY);
      }
    };
    const onPointerMove = (e) => handleMove(e.clientX, e.clientY);
    const onPointerUp = handleEnd;

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const [composing, setComposingRaw] = useState(false);
  const [composeClosing, setComposeClosing] = useState(false);
  const [composeDraft, setComposeDraft] = useState(null);
  const composeCloseTimer = useRef(null);

  // Opening (from anywhere) cancels a pending close animation
  const setComposing = (value) => {
    if (value) {
      clearTimeout(composeCloseTimer.current);
      setComposeClosing(false);
    }
    setComposingRaw(value);
  };

  // Closing plays the exit animation first, then unmounts
  const closeCompose = () => {
    setComposeClosing(true);
    clearTimeout(composeCloseTimer.current);
    composeCloseTimer.current = setTimeout(() => {
      setComposingRaw(false);
      setComposeDraft(null);
      setComposeClosing(false);
    }, COMPOSE_EXIT_MS);
  };

  useEffect(() => () => clearTimeout(composeCloseTimer.current), []);

  // Conversation pane: keep rendering the last opened chat while it slides/fades out
  const [chatItem, setChatItem] = useState(null);
  const [chatClosing, setChatClosing] = useState(false);
  const chatItemRef = useRef(null);
  const topBarWrapRef = useRef(null);
  const listPaneRef = useRef(null);
  useEffect(() => {
    if (selectedItem) {
      chatItemRef.current = selectedItem;
      setChatItem(selectedItem);
      setChatClosing(false);
      return undefined;
    }
    if (!chatItemRef.current) return undefined; // nothing was open, nothing to animate out
    setChatClosing(true);
    const timer = setTimeout(() => {
      chatItemRef.current = null;
      setChatItem(null);
      setChatClosing(false);
    }, CHAT_EXIT_MS);
    return () => clearTimeout(timer);
  }, [selectedItem]);

  const [undoToast, setUndoToast] = useState(null);
  const undoIntervalRef = useRef(null);

  // Load current user profile
  useEffect(() => {
    getMe().then(({ data }) => setMe(data)).catch(() => {});
  }, []);

  // Fetch threads (for Home/Spam/Trash), and counts
  const loadData = useCallback(async () => {
    // Unconditionally fetch counts for Important and Trash badges
    (async () => {
      try {
        const [trashRes, impRes] = await Promise.allSettled([
          getThreads({ folder: "trash" }),
          getImportantMessages(),
        ]);
        if (trashRes.status === "fulfilled" && Array.isArray(trashRes.value?.data)) {
          setTrashCount(trashRes.value.data.length);
        }
        if (impRes.status === "fulfilled" && Array.isArray(impRes.value?.data)) {
          setImportantCount(impRes.value.data.length);
        }
      } catch (err) {
        console.error("[Mail] Failed to load badges:", err);
      }
    })();

    if (folder === "important") {
      setLoading(false);
      return;
    }

    if (folder === "drafts") {
      try {
        const { data } = await getDrafts();
        setDrafts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[Mail] Failed to load drafts:", e.message);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      if (folder === "home" || folder === "trash" || folder === "spam") {
        const { data } = await getThreads({
          folder,
          q: query || undefined,
          filter: filter === "all" ? undefined : filter,
        });
        setThreads(data);
        // If an item was selected, update its reference from fresh data
        if (selectedItem) {
          const fresh = data.find((t) => t.id === selectedItem.id);
          if (fresh) setSelectedItem(fresh);
        }
      } else {
        const { data } = await getEmails({
          folder,
          q: query || undefined,
        });
        let filtered = data;
        if (filter === "unread") filtered = data.filter((e) => !e.is_read);
        else if (filter === "attachments") filtered = data.filter((e) => e.has_attachments);
        else if (filter === "favorites") filtered = data.filter((e) => e.is_favorite);
        setEmails(filtered);
        if (selectedItem) {
          const fresh = filtered.find((e) => e.id === selectedItem.id);
          if (fresh) setSelectedItem(fresh);
        }
      }
    } catch (e) {
      console.error("[Mail] Load error:", e.message); setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [folder, filter, query, selectedItem?.id]);

  useEffect(() => {
    if (!(folder === "home" || folder === "trash" || folder === "spam")) return undefined;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const { data } = await getThreads({ folder, q: query || undefined, filter: filter === "all" ? undefined : filter });
        if (!stop && Array.isArray(data)) setThreads((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      } catch {}
    };
    const id = setInterval(tick, 4000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", tick); };
  }, [folder, filter, query]);

  useEffect(() => {
    loadData();
  }, [folder, filter, query]);

  // Offline queue flusher
  const flushOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        await sendMail(item.payload);
      } catch {
        remaining.push(item);
      }
    }
    setOfflineQueue(remaining);
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener("online", flushOfflineQueue);
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, [flushOfflineQueue]);

  // Dispatch send
  const dispatchSend = useCallback(async (payload, tempId) => {
    const isOnline = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
    if (!isOnline) {
      const queue = getOfflineQueue();
      queue.push({ id: tempId, payload, createdAt: new Date().toISOString() });
      setOfflineQueue(queue);
      return;
    }
    try {
      await sendMail(payload);
      loadData();
    } catch (err) {
      console.error("[Mail] Send error:", err);
    }
  }, [loadData]);

  // Send with 5-second Undo Toast
  // â”€â”€ Drafts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const newDraftId = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const handleSaveDraft = async (d) => {
    try {
      await saveDraft(d.id || newDraftId(), {
        to: d.to,
        subject: d.subject,
        text: d.text,
        threadId: d.threadId,
        inReplyTo: d.inReplyTo,
        lockedRecipient: d.lockedRecipient,
      });
      if (folder === "drafts") loadData();
      else getDrafts().then(({ data }) => setDrafts(Array.isArray(data) ? data : [])).catch(() => {});
    } catch (e) {
      console.error("[Mail] Failed to save draft:", e.message);
    }
  };

  const handleOpenDraft = (d) => {
    setComposeDraft({
      to: d.to,
      subject: d.subject,
      body: d.body,
      threadId: d.threadId,
      inReplyTo: d.inReplyTo,
      lockedRecipient: d.lockedRecipient,
      draftId: d.id,
    });
    setComposing(true);
  };

  const handleDeleteDraft = async (d) => {
    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    try {
      await deleteDraft(d.id);
    } catch (e) {
      console.error("[Mail] Failed to delete draft:", e.message);
      loadData();
    }
  };

  const handleInitiateSend = (payload, draftData) => {
    // A message that's being sent no longer belongs in Drafts.
    if (draftData?.draftId) deleteDraft(draftData.draftId).catch(() => {});
    const tempId = `temp-${Date.now()}`;

    if (undoToast?.timerId) clearTimeout(undoToast.timerId);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    let count = 5;
    const interval = setInterval(() => {
      count -= 1;
      setUndoToast((cur) => (cur ? { ...cur, secondsLeft: count } : null));
    }, 1000);
    undoIntervalRef.current = interval;

    const timerId = setTimeout(() => {
      clearInterval(interval);
      setUndoToast(null);
      dispatchSend(payload, tempId);
    }, 5000);

    setUndoToast({ timerId, secondsLeft: 5, payload, draftData, tempId });
  };

  const handleUndo = () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);
    clearInterval(undoIntervalRef.current);
    setComposeDraft(undoToast.draftData);
    setUndoToast(null);
    setComposing(true);
  };

  // Selecting a thread or email row
  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    if (folder !== "home" && !item.is_read) {
      try {
        await updateEmail(item.id, { is_read: 1 });
        setEmails((prev) => prev.map((e) => (e.id === item.id ? { ...e, is_read: 1 } : e)));
      } catch {}
    }
  };

  // Open Traditional View from chat
  const handleOpenTraditionalCompose = (targetThread, replyMsg = null, carry = {}) => {
    let toVal = "";
    if (targetThread.is_group) {
      toVal = (targetThread.participants || []).filter((p) => p !== me?.email_address).join(", ");
    } else {
      toVal = targetThread.counterpart || "";
    }
    const replySubject = replyMsg
      ? (replyMsg.subject?.startsWith("Re:") ? replyMsg.subject : `Re: ${replyMsg.subject || ""}`)
      : "";
    setComposeDraft({
      to: toVal,
      subject: replySubject || carry.subject || "",
      body: carry.body || "",
      threadId: targetThread.id,
      lockedRecipient: true,
      inReplyTo: replyMsg ? (replyMsg.message_id || replyMsg.id) : null,
    });
    setComposing(true);
  };

  // Group: reply privately to one sender -> switch to or create their 1:1 thread
  const handleReplyPrivately = async (message) => {
    const contactEmail = message.from_address;
    if (!contactEmail || contactEmail === me?.email_address) return;

    // Search if a 1:1 thread with this contact already exists in our list
    let existing1to1 = threads.find((t) => !t.is_group && t.counterpart === contactEmail);
    if (existing1to1) {
      setSelectedItem(existing1to1);
      return;
    }

    // Otherwise, create a draft 1:1 thread state
    const syntheticThread = {
      id: `new-${Date.now()}`,
      counterpart: contactEmail,
      counterpart_name: message.from_name || message.from_display,
      is_group: false,
      subject: message.subject ? `Re: ${message.subject.replace(/^(re:\s*)+/i, "")}` : "",
      last_message: "",
    };
    setSelectedItem(syntheticThread);
  };

  // `inert` is set as a DOM property (works on every React version) while a full-screen chat covers the list
  useEffect(() => {
    const covered = isMobile && Boolean(chatItem) && !chatClosing;
    [topBarWrapRef.current, listPaneRef.current].forEach((el) => {
      if (el) el.inert = covered;
    });
  }, [isMobile, chatItem, chatClosing]);

  // A thread changed (e.g. its group picture) â€” reflect it in the list and the open chat
  const handleThreadUpdated = (threadId, patch) => {
    setThreads((prev) => prev.map((th) => (th.id === threadId ? { ...th, ...patch } : th)));
    setSelectedItem((prev) => (prev && prev.id === threadId ? { ...prev, ...patch } : prev));
  };

  // Delete / Trash action
  const handleDeleteItem = async (item) => {
    try {
      const isThread = Boolean(item.participant_a || item.participants || item.counterpart); if (folder === "trash" && !delGate.ok) { setDelAsk({ item }); return; } delGate.ok = false;
      if (folder === "trash") {
        if (isThread) {
          await deleteThread(item.id, { folder: "trash" });
        } else {
          await deleteEmail(item.id);
        }
      } else {
        if (isThread) {
          await updateThread(item.id, { folder: "trash" });
        } else {
          await updateEmail(item.id, { folder: "trash" });
        }
      }
      loadData();
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch {}
  };

  // Restore action for spam / trash
  const handleRestoreItem = async (item) => {
    try {
      const isThread = Boolean(item.participant_a || item.participants || item.counterpart);
      if (isThread) {
        await updateThread(item.id, { folder: "home" });
      } else {
        await updateEmail(item.id, { folder: "home" });
      }
      loadData();
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch {}
  };

  const handleToggleRead = async (item) => {
    try {
      const isThread = folder === "home" || folder === "trash" || folder === "spam" || Boolean(item.participant_a || item.participants || item.counterpart);
      const isUnread = isThread ? (item.unread_count > 0) : !item.is_read;
      if (isThread) {
        await updateThread(item.id, { is_read: isUnread ? 1 : 0 });
      } else {
        await updateEmail(item.id, { is_read: isUnread ? 1 : 0 });
      }
      loadData();
    } catch (e) {
      console.error("[Mail] Toggle read error:", e);
    }
  };

  const handleToggleImportant = async (item) => {
    try {
      const isThread = folder === "home" || folder === "trash" || folder === "spam" || Boolean(item.participant_a || item.participants || item.counterpart);
      const isFav = Boolean(item.is_favorite);
      if (isThread) {
        await updateThread(item.id, { is_favorite: isFav ? 0 : 1 });
      } else {
        await updateEmail(item.id, { is_favorite: isFav ? 0 : 1 });
      }
      loadData();
    } catch (e) {
      console.error("[Mail] Toggle important error:", e);
    }
  };

  const handleArchiveItem = async (item) => {
    try {
      const isThread = folder === "home" || folder === "trash" || folder === "spam" || Boolean(item.participant_a || item.participants || item.counterpart);
      if (isThread) {
        await updateThread(item.id, { folder: "archive" });
      } else {
        await updateEmail(item.id, { folder: "archive" });
      }
      loadData();
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch (e) {
      console.error("[Mail] Archive error:", e);
    }
  };

  const handleTogglePin = async (item) => {
    try {
      const targetId = item?.id || item?.thread_id;
      if (!targetId) return;
      const current = threads.find((t) => t.id === targetId) || item;
      const isPinned = Number(current?.pinned) === 1 || current?.pinned === true;
      const nextPinned = isPinned ? 0 : 1;

      setThreads((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, pinned: nextPinned } : t))
      );
      if (selectedItem?.id === targetId) {
        setSelectedItem((prev) => (prev ? { ...prev, pinned: nextPinned } : prev));
      }

      await updateThread(targetId, { pinned: nextPinned });
      await loadData();
    } catch (e) {
      console.error("[Mail] Toggle pin error:", e);
      loadData();
    }
  };

  const handleToggleSelectTrash = (id) => {
    setSelectedTrashIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnterTrashSelection = (id) => {
    setTrashSelectionMode(true);
    setSelectedTrashIds(new Set([id]));
  };

  const handleBulkRestoreTrash = async () => {
    if (selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    try {
      await Promise.allSettled(
        ids.map((id) => updateThread(id, { folder: "home" }).catch(() => updateEmail(id, { folder: "home" })))
      );
      setSelectedTrashIds(new Set());
      setTrashSelectionMode(false);
      loadData();
    } catch (e) {
      console.error("[Mail] Bulk trash restore error:", e);
    }
  };

  const handleBulkDeleteTrash = async () => {
    if (selectedTrashIds.size === 0) return; if (folder === "trash" && !delGate.ok) { setDelAsk({ bulk: true }); return; } delGate.ok = false;
    const ids = Array.from(selectedTrashIds);
    try {
      await Promise.allSettled(
        ids.map((id) => folder === "spam" ? updateThread(id, { folder: "trash" }).catch(() => updateEmail(id, { folder: "trash" })) : deleteThread(id, { folder: "trash" }).catch(() => deleteEmail(id)))
      );
      setSelectedTrashIds(new Set());
      setTrashSelectionMode(false);
      loadData();
    } catch (e) {
      console.error("[Mail] Bulk trash delete error:", e);
    }
  };

  if (me?.mustChangePassword) {
    return <ChangePassword onDone={() => setMe({ ...me, mustChangePassword: false })} />;
  }

  const items = (folder === "home" || folder === "trash" || folder === "spam") ? threads : emails;

  // On phones the open chat is a full-screen layer above the list + top bar.
  const chatIsFullScreen = isMobile && Boolean(chatItem);
  const showTopBar = isMobile || !(HIDE_TOPBAR_IN_CHAT_ON_DESKTOP && chatItem && !chatClosing);
  // Keep keyboard / screen-reader focus out of what the full-screen chat is covering
  const chatCoversList = chatIsFullScreen && !chatClosing;
  const coveredProps = chatCoversList ? { "aria-hidden": true } : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", overflow: "hidden", padding: isNarrow ? "calc(8px + env(safe-area-inset-top, 0px)) 8px 8px 8px" : 12, gap: isNarrow ? 8 : 12, boxSizing: "border-box" }}>
      {/* â”€â”€ Top Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showTopBar && (
        <div ref={topBarWrapRef} {...coveredProps} style={{ flexShrink: 0 }}>
          <TopBar
            query={query}
            onQueryChange={setQuery}
            me={me}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          />
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: isNarrow ? 0 : 12, minHeight: 0 }}>
        {/* â”€â”€ Unified Left-Hand Menu (Sidebar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Sidebar
          currentFolder={folder}
          onSelectFolder={(newFolder) => {
            setFolder(newFolder);
            setSelectedItem(null);
            setTrashSelectionMode(false);
            setSelectedTrashIds(new Set());
          }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          importantCount={importantCount}
          trashCount={trashCount}
          draftsCount={drafts.length}
        />

        {/* â”€â”€ Relative wrapper for Center List Pane + Right Chat Pane + ComposeModal â”€â”€ */}
        <main id="main-content" style={{ position: "relative", flex: 1, display: "flex", overflow: "hidden" }}>
          {/* â”€â”€ Center: Thread / Message List Pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div
            ref={listPaneRef}
            {...coveredProps}
            style={{
              position: "relative",
              width: isNarrow ? "100%" : 360,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              flexShrink: 0,
              overflow: "hidden",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--border)",
              margin: 0,
              flex: isNarrow ? 1 : undefined,
            }}
          >
            {/* Persistent Center Pane Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 68,
                boxSizing: "border-box",
                padding: "0 16px",
                background: colors.surface,
                borderBottom: `1px solid ${colors.border}`,
                flexShrink: 0,
              }}
            >
              {(folder === "important" || folder === "drafts") && listSelBar ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button" className="icon-btn icon-btn-danger" onClick={listSelBar.onCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: colors.danger, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }} title={t("selCancelBtn")} aria-label={t("selCancelBtn")}>
                      <X size={18} strokeWidth={2} color="currentColor" />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                      {t("selCount").replace("{n}", listSelBar.count)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button" className="btn-text" onClick={listSelBar.onAction} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: 600 }} title={listSelBar.label}>
                      {listSelBar.icon}
                      <span>{listSelBar.label}</span>
                    </button>
                  </div>
                </div>
              ) : (folder === "trash" || folder === "spam") && trashSelectionMode ? (                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => {
                        setTrashSelectionMode(false);
                        setSelectedTrashIds(new Set());
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: colors.danger,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 4,
                      }}
                      title={t("selCancelBtn")}
                      aria-label={t("selCancelBtn")}
                    >
                      <X size={18} strokeWidth={2} color="currentColor" />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                      {t("selCount").replace("{n}", selectedTrashIds.size)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={handleBulkRestoreTrash}
                      disabled={selectedTrashIds.size === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: selectedTrashIds.size > 0 ? "var(--text)" : "var(--muted)",
                        cursor: selectedTrashIds.size > 0 ? "pointer" : "default",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      title={t("selRestoreBtn")}
                    >
                      <RotateCcw size={15} strokeWidth={2} color="currentColor" />
                      <span>{t("selRestoreBtn")}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={handleBulkDeleteTrash}
                      disabled={selectedTrashIds.size === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: selectedTrashIds.size > 0 ? "var(--text)" : "var(--muted)",
                        cursor: selectedTrashIds.size > 0 ? "pointer" : "default",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      title={t("selDeleteBtn")}
                    >
                      <Trash2 size={15} strokeWidth={2} color="currentColor" />
                      <span>{t("selDeleteBtn")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isNarrow && <Logo size={40} />}
                    <h1
                      style={{
                        margin: 0,
                        fontSize: 20,
                        fontWeight: 700,
                        color: colors.textPrimary,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {folder === "home"
                        ? t("mailChats")
                        : folder === "important"
                        ? t("folderImportant")
                        : folder === "drafts"
                        ? t("folderDrafts")
                        : folder === "spam"
                        ? t("folderSpam")
                        : folder === "trash"
                        ? t("folderTrash")
                        : t("mailChats")}
                    </h1>
                  </div>
                  {(folder === "trash" || folder === "spam") && items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTrashSelectionMode(true)}
                      style={{
                        background: "none",
                        border: `1px solid ${colors.borderStrong}`,
                        borderRadius: 6,
                        color: colors.textPrimary,
                        cursor: "pointer",
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t("selSelectBtn")}
                    </button>
                  )}
                </>
              )}
            </div>

            <div key={folder} className="view-fade" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: isNarrow ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 0 }}>
            {folder === "important" ? (
              <ImportantList
                onSelBar={setListSelBar}
                onSelect={(item) => {
                  
                  setSelectedItem({
                    ...item.thread,
                    scrollToMessageId: item.id,
                  });
                }}
              />
            ) : folder === "drafts" ? (
              <DraftsList drafts={drafts} onOpen={handleOpenDraft} onDelete={handleDeleteDraft} onSelBar={setListSelBar} />
            ) : (
              <>
                {loadError && (
                  <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "8px 8px 0", padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}>
                    <span>{t("loadFailed")}</span>
                    <button type="button" onClick={() => loadData()} style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 8, padding: "6px 12px", minHeight: 36, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t("loadRetry")}</button>
                  </div>
                )}
                {/* Filter Chips above list */}
                <FilterChips active={filter} onChange={setFilter} />

                {/* List items */}
                <ThreadList
                  items={items}
                  selectedId={selectedItem?.id}
                  onSelect={handleSelectItem}
                  loading={loading}
                  folder={folder}
                  filter={filter}
                  onDelete={handleDeleteItem}
                  onRestore={handleRestoreItem}
                  onToggleRead={handleToggleRead}
                  onToggleImportant={handleToggleImportant}
                  onArchive={handleArchiveItem}
                  onTogglePin={handleTogglePin}
                  onRetry={(failed) => dispatchSend(failed.payload, failed.id)}
                  trashSelectionMode={trashSelectionMode}
                  selectedTrashIds={selectedTrashIds}
                  onToggleSelectTrash={handleToggleSelectTrash}
                  onEnterTrashSelection={handleEnterTrashSelection}
                  query={query}
                />
              </>
            )}
            </div>

            {delAsk && (
        <div className="formal-overlay-backdrop" onClick={() => setDelAsk(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="formal-overlay-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, maxWidth: 380, width: "100%", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Trash2 size={22} strokeWidth={2} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{t("delConfirmTitle")}</h3>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{t("delConfirmBody")}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setDelAsk(null)} style={{ flex: 1, minHeight: 44, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}>{t("selCancelBtn")}</button>
              <button type="button" onClick={() => { const a = delAsk; setDelAsk(null); delGate.ok = true; if (a.bulk) handleBulkDeleteTrash(); else handleDeleteItem(a.item); }} style={{ flex: 1, minHeight: 44, borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--on-primary)", fontWeight: 600, cursor: "pointer" }}>{t("selDeleteBtn")}</button>
            </div>
          </div>
        </div>
      )}
      {/* Scoped Floating Action Button for composing new message */}
            {(
              <button
                type="button"
                className="fab-btn"
                onClick={() => {
                  setComposeDraft(null);
                  setComposing(true);
                }}
                style={{
                  position: "absolute",
                  bottom: isNarrow ? "calc(80px + env(safe-area-inset-bottom, 0px))" : 16,
                  right: 16,
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "var(--shadow-sm)",
                  zIndex: 10,
                }}
                title={t("composeFab") || "Compose new message"}
                aria-label={t("composeFab") || "Compose new message"}
              >
                <ComposeIcon size={22} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {/* â”€â”€ Right: WhatsApp/Spike Style Chat / Conversation View â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {(() => {
            const chatView = chatItem ? (
              <ChatView
                key={chatItem.id}
                thread={chatItem}
                folder={folder}
                scrollToMessageId={chatItem?.scrollToMessageId}
                me={me}
                onInitiateSend={handleInitiateSend}
                onOpenTraditionalCompose={handleOpenTraditionalCompose}
                onReplyPrivately={handleReplyPrivately}
                onDeleteThread={handleDeleteItem}
                onThreadUpdated={handleThreadUpdated}
                onBack={() => setSelectedItem(null)}
              />
            ) : null;

            // Phone / narrow: conversation slides in over the list as a floating card (B4)
            if (isNarrow) {
              return chatItem ? (
                <div
                  className={`chat-pane--mobile${chatClosing ? " closing" : ""}`}
                  style={{
                    position: "fixed",
                    inset: "calc(8px + env(safe-area-inset-top, 0px)) 8px calc(8px + env(safe-area-inset-bottom, 0px)) 8px",
                    zIndex: 1001,
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bg)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    overflow: "clip",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {chatView}
                </div>
              ) : null;
            }

            // Desktop: right-hand pane next to the list
            return (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: "var(--bg)",
                  minWidth: 0,
                  isolation: "isolate",
                  marginLeft: isNarrow ? 0 : 12,
                  ...(isNarrow ? {} : {
                    borderRadius: "var(--r-lg)",
                    border: `1px solid ${colors.border}`,
                  }),
                }}
              >
                {chatItem ? (
                  <div
                    key={chatItem.id}
                    className={`chat-pane--desktop${chatClosing ? " closing" : ""}`}
                    style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
                  >
                    {chatView}
                  </div>
                ) : (
                  (() => {
                    const cfg = FOLDER_EMPTY_CONFIG[folder] || FOLDER_EMPTY_CONFIG.home;
                    return (
                      <EmptyState
                        Icon={cfg.icon}
                        title={t(cfg.titleKey)}
                        body={t(cfg.bodyKey)}
                      />
                    );
                  })()
                )}
              </div>
            );
          })()}

          {/* Traditional Compose Modal */}
          {composing && (
            <ComposeModal
              initialDraft={composeDraft}
              closing={composeClosing}
              fixed={isMobile}
              onClose={closeCompose}
              onSend={handleInitiateSend}
              onSaveDraft={handleSaveDraft}
            />
          )}
        </main>
      </div>

      {/* Undo Send Toast */}
      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            background: "var(--raised)",
            color: "var(--text)",
            padding: "10px 18px",
            borderRadius: "var(--r-md)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "var(--shadow-lg)",
            zIndex: 2000, transform: "translateX(-50%)", bottom: (() => { const c = document.querySelector(".chat-composer-container"); return c ? Math.round(window.innerHeight - c.getBoundingClientRect().top + 8) : 96; })(), left: (() => { const c = document.querySelector(".chat-composer-container"); if (!c) return "50%"; const r = c.getBoundingClientRect(); return Math.round(r.left + r.width / 2); })(),
            fontSize: 14,
            border: "1px solid var(--border)",
          }}
        >
          <span>{t("messageSending", undoToast.secondsLeft)}</span>
          <button
            type="button"
            className="btn-secondary"
            aria-label={t("undo") || "Undo"}
            style={{
              background: "none",
              border: "none",
              color: "var(--link)",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
              padding: "8px 12px",
              minHeight: 48,
              minWidth: 48,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={handleUndo}
          >
            {t("undo")}
          </button>
        </div>
      )}
    </div>
  );
}
