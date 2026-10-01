import React, { useState, useEffect } from "react";
import { updateEmail, downloadAttachment, BASE_URL } from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { Reply, Trash2, ShieldAlert, Star, Volume2, VolumeX, FileText, Download, Check, CheckCheck, ArrowRight } from "lucide-react";
import {
  VOICE_LANGUAGES,
  getSavedSpeechLang,
  saveSpeechLang,
  speakText,
  stopSpeaking,
  isSpeechSynthesisSupported,
} from "../utils/speech.js";
import ThemedSelect from "./ThemedSelect.jsx";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ── Display name helpers (fixes legibility bug) ───────────────────────────────
function resolveFrom(email) {
  return email.from_name || email.from_display || email.from_address || "";
}

function resolveTo(email) {
  return email.to_display || email.to_address || "";
}

export default function EmailView({ email, refreshList, onReply }) {
  const { colors } = useTheme();

  if (!email) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, background: colors.surface }}>
        Select an email to read it.
      </div>
    );
  }

  const [ttsLang, setTtsLang] = useState(getSavedSpeechLang());
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
    return () => { stopSpeaking(); };
  }, [email?.id]);

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    const textToSpeak = email.body_text || email.subject || "";
    if (!textToSpeak.trim()) return;
    speakText(textToSpeak, ttsLang, {
      onStart: () => setIsSpeaking(true),
      onEnd:   () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleTtsLangChange = (val) => {
    const newLang = typeof val === "object" ? val.target.value : val;
    setTtsLang(newLang);
    saveSpeechLang(newLang);
    if (isSpeaking) {
      stopSpeaking();
      const textToSpeak = email.body_text || email.subject || "";
      if (textToSpeak.trim()) {
        speakText(textToSpeak, newLang, {
          onStart: () => setIsSpeaking(true),
          onEnd:   () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    }
  };

  const act = async (patch) => {
    await updateEmail(email.id, patch);
    refreshList();
  };

  const attachments = Array.isArray(email.attachments)
    ? email.attachments
    : (() => { try { return JSON.parse(email.attachments || "[]"); } catch { return []; } })();

  // ── Derived display values ─────────────────────────────────────────────────
  const fromDisplay = resolveFrom(email);
  const toDisplay   = resolveTo(email);

  return (
    <div className="chat-scroll-container" style={{ flex: 1, padding: 24, overflowY: "auto", background: colors.surface, color: colors.textPrimary }}>
      <div style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {onReply && (
            <button
              type="button"
              className="btn-text"
              style={{
                color: "var(--link)",
                background: "var(--raised)",
                fontSize: 13,
                fontWeight: 600,
              }}
              title="Reply to message"
              onClick={() => onReply(email)}
            >
              <Reply size={14} />
              <span>Reply</span>
            </button>
          )}
          <button type="button" className="icon-btn" style={{ border: "none", background: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center" }} title="Move to trash" onClick={() => act({ folder: "trash" })}>
            <Trash2 size={17} color={colors.textSecondary} />
          </button>
          <button type="button" className="icon-btn" style={{ border: "none", background: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center" }} title="Mark as spam" onClick={() => act({ folder: "spam" })}>
            <ShieldAlert size={17} color={colors.textSecondary} />
          </button>
          <button type="button" className="icon-btn" style={{ border: "none", background: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center" }} title="Favorite" onClick={() => act({ is_favorite: email.is_favorite ? 0 : 1 })}>
            <Star size={17} fill={email.is_favorite ? "var(--important)" : "none"} color={email.is_favorite ? "var(--important)" : colors.textSecondary} />
          </button>
        </div>

        {/* TTS controls */}
        {isSpeechSynthesisSupported() && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn-text"
              style={{
                background: isSpeaking ? "var(--primary)" : "var(--raised)",
                color: isSpeaking ? "var(--on-primary)" : "var(--text)",
                border: isSpeaking ? "none" : "1px solid var(--border-strong)",
                fontSize: 13,
                fontWeight: 600,
              }}
              onClick={handleToggleSpeak}
              title={isSpeaking ? "Stop reading aloud" : "Read message aloud"}
            >
              {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span>{isSpeaking ? "Stop reading" : "Read aloud"}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 14, padding: "2px 6px" }}>
              <ThemedSelect
                value={ttsLang}
                onChange={handleTtsLangChange}
                options={VOICE_LANGUAGES}
                title="Voice language for reading aloud"
              />
            </div>
          </div>
        )}
      </div>

      {/* Subject */}
      <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: colors.textPrimary }}>
        {email.subject || "(no subject)"}
      </h2>

      {/* Meta row — FIX: use resolved display names */}
      <div style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ color: colors.textPrimary }}>{fromDisplay}</strong>
          <ArrowRight size={13} style={{ display: "inline-block", verticalAlign: "middle", margin: "0 6px", opacity: 0.6 }} aria-hidden="true" />
          {toDisplay}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {email.delivery_status && (
            <span
              style={{ fontSize: 12, fontWeight: 600, color: email.delivery_status === "read" ? colors.textAccent : colors.textSecondary, display: "inline-flex", alignItems: "center", gap: 3 }}
              title={`Status: ${email.delivery_status}`}
            >
              {email.delivery_status === "read" ? (
                <>
                  <CheckCheck size={13} color={colors.textAccent} /> Read
                </>
              ) : email.delivery_status === "delivered" ? (
                <>
                  <CheckCheck size={13} color={colors.textSecondary} /> Delivered
                </>
              ) : (
                <>
                  <Check size={13} color={colors.textSecondary} /> Sent
                </>
              )}
            </span>
          )}
          <span style={{ color: colors.textSecondary }}>{new Date(email.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Body */}
      <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", color: colors.textPrimary }}>
        {email.body_text}
      </p>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={{ marginTop: 32, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: colors.textMuted, fontWeight: 600 }}>
            Attachments ({attachments.length})
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {attachments.map((att, idx) => {
              const isImage = (att.contentType || att.mime_type || "").startsWith("image/");
              const isPdf = (att.contentType || att.mime_type || "").toLowerCase().includes("pdf") || (att.filename || "").toLowerCase().endsWith(".pdf");
              const downloadUrl = `${BASE_URL}/mail/attachments/${att.id}/download?token=${encodeURIComponent(localStorage.getItem("phonemail_token") || "")}`;
              const previewUrl  = `${BASE_URL}/mail/attachments/${att.id}?token=${encodeURIComponent(localStorage.getItem("phonemail_token") || "")}`;

              return (
                <div key={att.id || idx} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, width: 220, overflow: "hidden", background: colors.surfaceAlt, display: "flex", flexDirection: "column" }}>
                  {isImage ? (
                    <div style={{ width: "100%", height: 110, background: colors.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <img src={previewUrl} alt={att.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                  ) : isPdf ? (
                    <div style={{ width: "100%", height: 140, background: colors.surfaceAlt, overflow: "hidden" }}>
                      <iframe src={previewUrl} title={att.filename} style={{ width: "100%", height: 140, border: "none" }} />
                    </div>
                  ) : (
                    <div style={{ width: "100%", height: 80, background: colors.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={32} color={colors.textSecondary} />
                    </div>
                  )}
                  <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={att.filename}>{att.filename}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary }}>{formatBytes(att.size)}</div>
                    <a
                      href={downloadUrl}
                      download={att.filename}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: colors.textAccent, textDecoration: "none", fontWeight: 500, marginTop: 4 }}
                      onClick={async (e) => {
                        e.preventDefault();
                        try { await downloadAttachment(att.id, att.filename); }
                        catch { window.open(downloadUrl, "_blank"); }
                      }}
                    >
                      ⬇ Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
