import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Trash2, X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { uploadAttachment, updateGroupAvatar } from "../api/client.js";
import { formatPhoneNumber } from "../utils/contact.js";
import { squareResize } from "../utils/image.js";
import Avatar from "./Avatar.jsx";

const CLOSE_MS = 160;

/**
 * Group details. Every member can change the group picture; the change is stored on the
 * thread, so it shows up for everyone in the group.
 */
export default function GroupInfoModal({ thread, me, onClose, onUpdated }) {
  const { colors } = useTheme();
  const isMobile = useIsMobile(1023);
  const fileRef = useRef(null);

  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Shown instantly after choosing a photo, before the server round-trip completes
  const [avatarSrc, setAvatarSrc] = useState(thread.avatar_url || null);

  const groupName = thread.group_name || thread.counterpart || "Group Conversation";
  const participants = Array.isArray(thread.participants) ? thread.participants : [];

  const requestClose = () => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") requestClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAvatar = (attachmentId, previewSrc) => {
    setAvatarSrc(previewSrc);
    onUpdated({
      group_avatar_id: attachmentId,
      avatar_url: attachmentId ? `/mail/attachments/${attachmentId}` : null,
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setBusy(true);
    try {
      const square = await squareResize(file);
      const preview = URL.createObjectURL(square);
      const { data } = await uploadAttachment(square);
      await updateGroupAvatar(thread.id, data.id);
      applyAvatar(data.id, preview);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Could not update the group picture.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError("");
    setBusy(true);
    try {
      await updateGroupAvatar(thread.id, null);
      applyAvatar(null, null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Could not remove the group picture.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className={`formal-overlay-backdrop${closing ? " closing" : ""}`}
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 9999,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,
      }}
    >
      <div
        className={`formal-overlay-card${closing ? " closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Group details"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: isMobile ? "var(--r-xl) var(--r-xl) 0 0" : "var(--r-xl)",
          border: `1px solid ${colors.border}`,
          padding: 24,
          paddingBottom: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 24,
          maxWidth: isMobile ? "100%" : 380,
          width: "100%",
          maxHeight: isMobile ? "92dvh" : "88vh",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
          margin: 0,
          overflowY: "auto",
        }}
      >
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "0 0 8px", flexShrink: 0 }}>
            <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border-strong)" }} />
          </div>
        )}
        <button
          type="button"
          onClick={requestClose}
          className="icon-btn"
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            border: "none",
            background: "none",
            color: colors.textSecondary,
            cursor: "pointer",
            padding: 6,
            display: "flex",
          }}
        >
          <X size={18} strokeWidth={2} />
        </button>

        {/* Picture + name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Avatar
              src={avatarSrc}
              name={groupName}
              colorKey={thread.counterpart || thread.group_name}
              isGroup
              size={96}
              style={{ opacity: busy ? 0.6 : 1, transition: "opacity 0.15s ease" }}
            />
            <button
              type="button"
              className="avatar-edit-btn"
              onClick={() => fileRef.current && fileRef.current.click()}
              disabled={busy}
              title="Change group picture"
              aria-label="Change group picture"
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: `3px solid ${colors.surface}`,
                background: colors.accent,
                color: "var(--on-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: busy ? "wait" : "pointer",
                padding: 0,
              }}
            >
              <Camera size={16} strokeWidth={2.2} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 18, color: colors.textPrimary }}>{groupName}</h3>
            <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
              Group · {participants.length} participants
            </p>
          </div>

          {avatarSrc && (
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={handleRemove}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                background: "none",
                color: colors.textSecondary,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                padding: "4px 10px",
              }}
            >
              <Trash2 size={14} strokeWidth={2} />
              <span>Remove picture</span>
            </button>
          )}

          {error && (
            <div
              style={{
                width: "100%",
                padding: "8px 12px",
                background: colors.dangerBg,
                color: colors.danger,
                borderRadius: 8,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Members */}
        {participants.length > 0 && (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minHeight: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
              Members
            </span>
            <div className="chat-scroll-container" style={{ overflowY: "auto", maxHeight: 220, display: "flex", flexDirection: "column", gap: 2 }}>
              {participants.map((addr) => {
                const isMe = me?.email_address && addr.toLowerCase() === me.email_address.toLowerCase();
                return (
                  <div key={addr} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
                    <Avatar
                      src={isMe ? me?.avatar_url : null}
                      name={isMe ? (me?.display_name || "You") : addr}
                      colorKey={addr}
                      size={30}
                      fontSize={12}
                    />
                    <span style={{ fontSize: 14, color: colors.textPrimary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isMe ? "You" : formatPhoneNumber(addr)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, textAlign: "center" }}>
          Anyone in this group can change its picture.
        </p>
      </div>
    </div>,
    document.body
  );
}
