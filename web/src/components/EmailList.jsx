import React, { useState, useRef } from "react";
import { Archive, Trash2, Paperclip, Clock, AlertTriangle } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { parseServerDate } from "../utils/dateFix.js";

// ── Display name helper (fixes raw phone-number legibility) ──────────────────
function senderLabel(email) {
  return email.from_name || email.from_display || email.from_address || "";
}

function SwipeableEmailRow({ email, selectedId, onSelect, onRetry, onDelete, onArchive }) {
  const { colors } = useTheme();
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    const damped = Math.max(-120, Math.min(120, diff));
    setOffsetX(damped);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (offsetX < -70 && onDelete) onDelete(email);
    else if (offsetX > 70 && (onArchive || onDelete)) {
      if (onArchive) onArchive(email);
      else onDelete(email);
    }
    setOffsetX(0);
  };

  const handleMouseDown = (e) => {
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - startXRef.current;
    const damped = Math.max(-120, Math.min(120, diff));
    setOffsetX(damped);
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (offsetX < -70 && onDelete) onDelete(email);
    else if (offsetX > 70 && (onArchive || onDelete)) {
      if (onArchive) onArchive(email);
      else onDelete(email);
    }
    setOffsetX(0);
  };

  const isSending = email.status === "sending";
  const isFailed  = email.status === "failed";
  const isWaiting = email.status === "waiting_offline";
  const isActive  = selectedId === email.id;

  return (
    <div style={{ position: "relative", overflow: "hidden", background: colors.surface, borderBottom: `1px solid ${colors.border}`, userSelect: "none" }}>
      {/* Swipe action background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          fontSize: 13,
          fontWeight: 600,
          background: offsetX > 0 ? colors.successBg : colors.dangerBg,
          color:      offsetX > 0 ? colors.success    : colors.danger,
        }}
      >
        {offsetX > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Archive size={15} /> Archive</span>}
        <div style={{ flex: 1 }} />
        {offsetX < 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={15} /> Delete</span>}
      </div>

      {/* Foreground email row */}
      <div
        onClick={() => { if (Math.abs(offsetX) < 6) onSelect(email); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          cursor: "pointer",
          fontSize: 14,
          gap: 8,
          background: isActive ? colors.surfaceHover : colors.surface,
          position: "relative",
          fontWeight: email.is_read ? 400 : 700,
          color: colors.textPrimary,
          opacity: isSending ? 0.65 : 1,
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        {/* FIX: prefer from_name / from_display over raw address */}
        <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {senderLabel(email)}
        </span>

        <span style={{ width: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>
          {email.has_attachments && <Paperclip size={13} style={{ flexShrink: 0, marginRight: 4 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject || "(no subject)"}</span>
        </span>

        <span style={{ flex: 1, color: colors.textSecondary, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          — {email.body_text}
        </span>

        {/* Status indicators */}
        {isSending && (
          <span style={{ fontSize: 12, color: colors.textSecondary, padding: "2px 6px", background: colors.surfaceAlt, borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }} title="Sending…">
            <Clock size={12} /> Sending…
          </span>
        )}
        {isWaiting && (
          <span style={{ fontSize: 12, color: colors.warningFg, padding: "2px 6px", background: colors.surfaceAlt, borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }} title="Offline queue">
            <Clock size={12} /> Waiting to send
          </span>
        )}
        {isFailed && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(ev) => ev.stopPropagation()}>
            <span style={{ color: colors.danger, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} /> Failed
            </span>
            <button
              type="button"
              style={{ fontSize: 11, padding: "2px 6px", background: colors.danger, color: "var(--on-primary)", border: "none", borderRadius: 4, cursor: "pointer" }}
              onClick={() => onRetry && onRetry(email)}
            >
              Retry
            </button>
          </div>
        )}

        {!isSending && !isFailed && !isWaiting && (
          <span style={{ color: colors.textSecondary, fontSize: 12, width: 80, textAlign: "right" }}>
            {parseServerDate(email.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function EmailList({ emails, selectedId, onSelect, loading, onRetry, onDelete, onArchive }) {
  const { colors } = useTheme();

  if (loading && (!emails || emails.length === 0)) {
    return (
      <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto", background: colors.surface }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${colors.border}`, gap: 12 }}>
            <div style={{ height: 14, background: colors.surfaceAlt, borderRadius: 4, width: 130 }} />
            <div style={{ height: 14, background: colors.surfaceAlt, borderRadius: 4, width: 180 }} />
            <div style={{ height: 14, background: colors.surfaceAlt, borderRadius: 4, flex: 1 }} />
            <div style={{ height: 14, background: colors.surfaceAlt, borderRadius: 4, width: 60 }} />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: colors.textSecondary }}>No emails here.</div>;
  }

  return (
    <div className="chat-scroll-container" style={{ flex: 1, overflowY: "auto", background: colors.surface }}>
      {emails.map((e) => (
        <SwipeableEmailRow
          key={e.id}
          email={e}
          selectedId={selectedId}
          onSelect={onSelect}
          onRetry={onRetry}
          onDelete={onDelete}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
