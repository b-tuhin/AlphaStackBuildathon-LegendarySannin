import React, { useEffect, useState, useCallback, useRef } from "react";
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import FilterChips from "../components/FilterChips.jsx";
import ThreadList from "../components/ThreadList.jsx";
import ChatView from "../components/ChatView.jsx";
import ImportantList from "../components/ImportantList.jsx";
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
} from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { PenLine, MailOpen, Trash2, X, RotateCcw } from "lucide-react";

const OFFLINE_QUEUE_KEY = "phonemail_offline_queue";

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); }
  catch { return []; }
}

function setOfflineQueue(queue) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export default function Mail() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isMobile = useIsMobile(768);

  const [me, setMe] = useState(null);
  const [folder, setFolder] = useState("home"); // "home" | "spam" | "trash"
  const [filter, setFilter] = useState("all");   // "all" | "unread" | "attachments" | "favorites" (Important)
  const [query, setQuery] = useState("");

  const [threads, setThreads] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  // Live badge counts for Important and Trash
  const [importantCount, setImportantCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);

  // Trash multi-select state
  const [trashSelectionMode, setTrashSelectionMode] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState(new Set());

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
  const [composing, setComposing] = useState(false);
  const [composeDraft, setComposeDraft] = useState(null);

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

    setLoading(true);
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
      console.error("[Mail] Load error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [folder, filter, query, selectedItem?.id]);

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
  const handleInitiateSend = (payload, draftData) => {
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
  const handleOpenTraditionalCompose = (targetThread, replyMsg = null) => {
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
      subject: replySubject,
      body: "",
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

  // Delete / Trash action
  const handleDeleteItem = async (item) => {
    try {
      const isThread = Boolean(item.participant_a || item.participants || item.counterpart);
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
    if (selectedTrashIds.size === 0) return;
    const ids = Array.from(selectedTrashIds);
    try {
      await Promise.allSettled(
        ids.map((id) => deleteThread(id, { folder: "trash" }).catch(() => deleteEmail(id)))
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: colors.bg, overflow: "hidden" }}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <TopBar
        query={query}
        onQueryChange={setQuery}
        me={me}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onUpdatedMe={setMe}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Unified Left-Hand Menu (Sidebar) ───────────────────────────── */}
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
        />

        {/* ── Relative wrapper for Center List Pane + Right Chat Pane + ComposeModal ── */}
        <div style={{ position: "relative", flex: 1, display: "flex", overflow: "hidden" }}>
          {/* ── Center: Thread / Message List Pane ─────────────────────────── */}
          <div
            style={{
              position: "relative",
              width: isMobile ? (selectedItem ? 0 : "100%") : 380,
              display: isMobile && selectedItem ? "none" : "flex",
              flexDirection: "column",
              borderRight: isMobile ? "none" : `1px solid ${colors.border}`,
              background: colors.surface,
              flexShrink: 0,
              overflow: "hidden",
              transition: "width 0.2s ease",
            }}
          >
            {/* Persistent Center Pane Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 10px 16px",
                background: colors.surface,
                borderBottom: `1px solid ${colors.border}`,
                flexShrink: 0,
              }}
            >
              {folder === "trash" && trashSelectionMode ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
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
                      title="Cancel selection"
                      aria-label="Cancel selection"
                    >
                      <X size={18} strokeWidth={2} color={colors.danger} />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                      {selectedTrashIds.size} selected
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={handleBulkRestoreTrash}
                      disabled={selectedTrashIds.size === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: selectedTrashIds.size > 0 ? colors.accentLight : colors.surfaceAlt,
                        border: `1px solid ${selectedTrashIds.size > 0 ? colors.accent : colors.border}`,
                        color: selectedTrashIds.size > 0 ? colors.accent : colors.textSecondary,
                        cursor: selectedTrashIds.size > 0 ? "pointer" : "default",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      title="Restore selected"
                    >
                      <RotateCcw size={15} strokeWidth={2} color={selectedTrashIds.size > 0 ? colors.accent : colors.textSecondary} />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={handleBulkDeleteTrash}
                      disabled={selectedTrashIds.size === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: selectedTrashIds.size > 0 ? colors.dangerBg : colors.surfaceAlt,
                        border: `1px solid ${selectedTrashIds.size > 0 ? colors.danger : colors.border}`,
                        color: selectedTrashIds.size > 0 ? colors.danger : colors.textSecondary,
                        cursor: selectedTrashIds.size > 0 ? "pointer" : "default",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      title="Permanently delete selected"
                    >
                      <Trash2 size={15} strokeWidth={2} color={selectedTrashIds.size > 0 ? colors.danger : colors.textSecondary} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                      ? "Chats"
                      : folder === "important"
                      ? t("folderImportant")
                      : folder === "spam"
                      ? t("folderSpam")
                      : folder === "trash"
                      ? t("folderTrash")
                      : "Chats"}
                  </h1>
                  {folder === "trash" && items.length > 0 && (
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
                      Select
                    </button>
                  )}
                </>
              )}
            </div>

            {folder === "important" ? (
              <ImportantList
                onSelect={(item) => {
                  setFolder("home");
                  setSelectedItem({
                    ...item.thread,
                    scrollToMessageId: item.id,
                  });
                }}
              />
            ) : (
              <>
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
                  onRetry={(failed) => dispatchSend(failed.payload, failed.id)}
                  trashSelectionMode={trashSelectionMode}
                  selectedTrashIds={selectedTrashIds}
                  onToggleSelectTrash={handleToggleSelectTrash}
                  onEnterTrashSelection={handleEnterTrashSelection}
                />
              </>
            )}

            {/* Scoped Floating Action Button for composing new message */}
            {!(isMobile && selectedItem) && (
              <button
                type="button"
                className="fab-btn"
                onClick={() => {
                  setComposeDraft(null);
                  setComposing(true);
                }}
                style={{
                  position: "absolute",
                  bottom: 20,
                  right: 20,
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  background: colors.accent,
                  color: "#ffffff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.22)",
                  zIndex: 10,
                }}
                title={t("composeFab") || "Compose new message"}
                aria-label={t("composeFab") || "Compose new message"}
              >
                <PenLine size={22} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {/* ── Right: WhatsApp/Spike Style Chat / Conversation View ───────── */}
          <div
            style={{
              flex: 1,
              display: isMobile && !selectedItem ? "none" : "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: colors.bg,
            }}
          >
            {selectedItem ? (
              <ChatView
                thread={selectedItem}
                folder={folder}
                scrollToMessageId={selectedItem?.scrollToMessageId}
                me={me}
                onInitiateSend={handleInitiateSend}
                onOpenTraditionalCompose={handleOpenTraditionalCompose}
                onReplyPrivately={handleReplyPrivately}
                onDeleteThread={handleDeleteItem}
                onBack={() => setSelectedItem(null)}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textSecondary,
                  gap: 12,
                }}
              >
                <div style={{ color: colors.textSecondary, display: "flex", justifyContent: "center" }}>
                  <MailOpen size={56} strokeWidth={1.2} color={colors.textSecondary} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>
                  {folder === "home" ? t("welcomeTitle") : `${folder.charAt(0).toUpperCase() + folder.slice(1)}`}
                </div>
                <p style={{ margin: 0, fontSize: 14, color: colors.textSecondary }}>
                  {t("welcomeBody")}
                </p>
              </div>
            )}
          </div>

          {/* Traditional Compose Modal */}
          {composing && (
            <ComposeModal
              initialDraft={composeDraft}
              onClose={() => {
                setComposing(false);
                setComposeDraft(null);
              }}
              onSend={handleInitiateSend}
            />
          )}
        </div>
      </div>

      {/* Undo Send Toast */}
      {undoToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            background: "#202124",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            zIndex: 2000,
            fontSize: 14,
          }}
        >
          <span>{t("messageSending", undoToast.secondsLeft)}</span>
          <button
            type="button"
            className="icon-btn"
            style={{
              background: "none",
              border: "none",
              color: "#8ab4f8",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
              padding: "4px 8px",
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
