import { EMAIL_DOMAIN } from "../config/brand.js";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, Paperclip, Mic, MicOff, Globe, Sparkles, Send, Lock } from "lucide-react";
import { uploadAttachment, assistDraft, lookupPhone, getFamiliarRecipients } from "../api/client.js";
import VoiceLanguageMenu from "./VoiceLanguageMenu.jsx";
import PlaceholderResolverBar from "./PlaceholderResolverBar.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import {
  VOICE_LANGUAGES,
  getSavedSpeechLang,
  saveSpeechLang,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
} from "../utils/speech.js";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const ASSIST_INTENT_CHIPS = [
  { id: "question",    label: "Ask a question",      intent: "Ask a polite question and request clarification" },
  { id: "request",     label: "Make a request",      intent: "Make a polite, formal request for assistance" },
  { id: "followup",    label: "Follow up",            intent: "Follow up politely on the status of my previous message" },
  { id: "appointment", label: "Book an appointment", intent: "Inquire about available slots to book an appointment" },
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
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

export default function ComposeModal({ onClose, onSend, onSaveDraft, initialDraft, closing = false, fixed = false }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isMobile = useIsMobile(1023);

  const [recipients, setRecipients]   = useState(() => {
    if (initialDraft?.to) {
      const parts = String(initialDraft.to).split(",").map((s) => s.trim()).filter(Boolean);
      return parts.map((addr) => {
        const phone = addr.split("@")[0].replace(/[^\d]/g, "");
        return {
          phone: phone || addr,
          email_address: addr.includes("@") ? addr : `${phone}@${EMAIL_DOMAIN}`,
          display_name: phone || addr,
        };
      });
    }
    return [];
  });
  const [recipientInput, setRecipientInput]       = useState("");
  const [lookingUp, setLookingUp]                 = useState(false);
  const [recipientError, setRecipientError]       = useState("");
  const [familiarList, setFamiliarList]           = useState([]);
  const [showSuggestions, setShowSuggestions]     = useState(false);
  const recipientInputRef                         = useRef(null);
  const suggestionsRef                            = useRef(null);

  useEffect(() => {
    getFamiliarRecipients()
      .then(({ data }) => {
        if (Array.isArray(data)) setFamiliarList(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        recipientInputRef.current &&
        !recipientInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addRecipientByPhone = async (inputStr) => {
    const raw = (inputStr || recipientInput).trim();
    if (!raw) return;
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length < 7) {
      setRecipientError("Enter a valid phone number (at least 7 digits)");
      return;
    }
    setLookingUp(true);
    setRecipientError("");
    try {
      const { data } = await lookupPhone(digits);
      if (recipients.some((r) => r.phone === data.phone || r.email_address === data.email_address)) {
        setRecipientError("Recipient already added");
      } else {
        setRecipients((prev) => [...prev, data]);
        setRecipientInput("");
        setRecipientError("");
        setShowSuggestions(false);
      }
    } catch (e) {
      setRecipientError("Not a registered user");
    } finally {
      setLookingUp(false);
    }
  };

  const addFamiliarRecipient = (contact) => {
    if (recipients.some((r) => r.phone === contact.phone || r.email_address === contact.email_address)) {
      setRecipientError("Recipient already added");
    } else {
      setRecipients((prev) => [...prev, contact]);
      setRecipientInput("");
      setRecipientError("");
      setShowSuggestions(false);
    }
  };

  const removeRecipient = (index) => {
    if (initialDraft?.lockedRecipient) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredSuggestions = useMemo(() => {
    const q = recipientInput.trim().toLowerCase();
    const existingAddrs = new Set(recipients.map((r) => r.email_address));
    const available = familiarList.filter((c) => !existingAddrs.has(c.email_address));
    if (!q) return available.slice(0, 6);
    return available
      .filter((c) =>
        (c.display_name && c.display_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email_address && c.email_address.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [familiarList, recipientInput, recipients]);

  const [subject, setSubject]         = useState(() => (isActualSubjectValue(initialDraft?.subject, initialDraft?.body) ? initialDraft.subject.trim() : ""));
  const [body, setBody]               = useState(initialDraft?.body || "");
  const [attachments, setAttachments] = useState(initialDraft?.attachments || []);
  const draftIdRef = useRef(initialDraft?.draftId || null);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState("");
  const fileInputRef                  = useRef(null);

  // ── Voice-to-Text ─────────────────────────────────────────────────────────
  const [voiceLang, setVoiceLang]     = useState(getSavedSpeechLang());
  const [isListening, setIsListening] = useState(false);
  const recognitionRef                = useRef(null);
  const baseTextRef                   = useRef("");

  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
    };
  }, []);

  const handleVoiceToggle = () => {
    setError("");
    if (isListening) {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      setIsListening(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    baseTextRef.current = body;
    const recognizer = createSpeechRecognizer({
      lang: voiceLang,
      onStart: () => setIsListening(true),
      onEnd:   () => setIsListening(false),
      onError: (ev) => {
        setIsListening(false);
        if (ev.error !== "no-speech") setError(`Voice input: ${ev.error === "not-allowed" ? "Microphone permission denied" : ev.error}`);
      },
      onResult: ({ finalTranscript, interimTranscript }) => {
        const finalChunk = (finalTranscript || "").trim();
        const interimChunk = (interimTranscript || "").trim();

        if (finalChunk) {
          const base = baseTextRef.current;
          const sep  = base && !base.endsWith(" ") && !base.endsWith("\n") ? " " : "";
          baseTextRef.current = base ? base + sep + finalChunk : finalChunk;
        }

        const currentBase = baseTextRef.current;
        if (interimChunk) {
          const sep = currentBase && !currentBase.endsWith(" ") && !currentBase.endsWith("\n") ? " " : "";
          setBody(currentBase ? currentBase + sep + interimChunk : interimChunk);
        } else if (finalChunk) {
          setBody(currentBase);
        }
      },
    });
    recognitionRef.current = recognizer;
    try { recognizer.start(); }
    catch (err) { setError("Could not start speech recognition: " + err.message); setIsListening(false); }
  };

  const handleLangChange = (e) => {
    const newLang = e.target.value;
    setVoiceLang(newLang);
    saveSpeechLang(newLang);
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }
  };

  // ── Assisted Draft ────────────────────────────────────────────────────────
  const [showAssist, setShowAssist]                 = useState(false);
  const [assistCustomIntent, setAssistCustomIntent] = useState("");
  const [assisting, setAssisting]                   = useState(false);
  const [aiAssisted, setAiAssisted]                 = useState(false);
  const [assistError, setAssistError]               = useState("");

  const handleGenerateAssist = async (intentText) => {
    const rawIntent = (intentText || assistCustomIntent || body || "").trim();
    if (!rawIntent) { setAssistError("Please choose an option or enter a rough note describing what to write."); return; }
    setAssisting(true);
    setAssistError("");
    try {
      const { data } = await assistDraft({
        threadId: initialDraft?.threadId,
        intent: rawIntent,
        isNewMessage: !initialDraft?.threadId,
        currentSubject: subject,
      });
      if (data.subject && (!subject || !initialDraft?.threadId) && isActualSubjectValue(data.subject, data.body, initialDraft?.body)) {
        setSubject(data.subject.trim());
      }
      if (data.body) setBody(data.body);
      setAiAssisted(true);
      setShowAssist(false);
      setAssistCustomIntent("");
    } catch (err) {
      setAssistError(err?.response?.data?.error || err.message || "Failed to generate draft");
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
        setError(`"${file.name}" (${formatBytes(file.size)}) exceeds the 10MB limit.`);
        e.target.value = "";
        return;
      }
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) { const { data } = await uploadAttachment(file); uploaded.push(data); }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to upload attachment");
    } finally { setUploading(false); e.target.value = ""; }
  };

  const removeAttachment = (index) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!body.trim() && attachments.length === 0) return setError(t("composeEmpty"));
    if (recipients.length === 0) {
      if (recipientInput.trim()) {
        addRecipientByPhone();
        return;
      }
      return setError("Add at least one recipient.");
    }
    const toPayload = recipients.length > 1 ? recipients.map((r) => r.email_address) : recipients[0].email_address;
    const payload = {
      to: toPayload,
      subject,
      text: body,
      attachments,
      inReplyTo: initialDraft?.inReplyTo,
    };
    const draftData = {
      to: Array.isArray(toPayload) ? toPayload.join(", ") : toPayload,
      subject,
      body,
      attachments,
      threadId: initialDraft?.threadId,
      inReplyTo: initialDraft?.inReplyTo,
      lockedRecipient: Boolean(initialDraft?.lockedRecipient),
      draftId: draftIdRef.current,
    };
    onSend(payload, draftData);
    onClose();
  };

  // Closing without sending keeps whatever was typed in the Drafts folder.
  const handleDiscard = () => {
    if (onSaveDraft && (body.trim() || subject.trim())) {
      onSaveDraft({
        id: draftIdRef.current,
        to: recipients.map((r) => r.email_address).join(", "),
        subject,
        text: body,
        threadId: initialDraft?.threadId,
        inReplyTo: initialDraft?.inReplyTo,
        lockedRecipient: Boolean(initialDraft?.lockedRecipient),
      });
    }
    onClose();
  };

  // ── Derived inline styles (theme-driven) ──────────────────────────────────
  const inputStyle = { border: "none", borderBottom: `1px solid ${colors.border}`, padding: "10px 16px", fontSize: 14, outline: "none", background: colors.surface, color: colors.textPrimary };
  const textareaStyle = { border: "none", padding: "12px 16px", fontSize: 14, minHeight: 180, resize: "vertical", outline: "none", background: colors.surface, color: colors.textPrimary };

  return (
    <div
      className={`formal-overlay-backdrop${closing ? " closing" : ""}`}
      onClick={handleDiscard}
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        background: "var(--scrim)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24,
        zIndex: 1100,
      }}
    >
      <div
        className={`formal-overlay-card${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : 680,
          maxHeight: isMobile ? "92dvh" : "92%",
          background: "var(--surface)",
          borderRadius: isMobile ? "var(--r-xl) var(--r-xl) 0 0" : "var(--r-xl)",
          border: `1px solid ${colors.borderStrong}`,
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          margin: 0,
          paddingBottom: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 0,
        }}
      >
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px", flexShrink: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: "var(--border-strong)",
              }}
            />
          </div>
        )}
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            background: colors.surfaceAlt,
            fontWeight: 600,
            borderBottom: `1px solid ${colors.border}`,
            color: colors.textPrimary,
          }}
        >
          <span>{initialDraft?.threadId ? t("formalReply") : t("newMessage")}</span>
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={handleDiscard}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: colors.danger,
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: 6,
            }}
            title="Close"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} color={colors.danger} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="chat-scroll-container" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
          {/* Recipient Chips Container */}
          <div
            style={{
              position: "relative",
              borderBottom: `1px solid ${colors.border}`,
              background: initialDraft?.lockedRecipient ? colors.surfaceAlt : colors.surface,
              padding: "8px 16px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              minHeight: 46,
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginRight: 4 }}>
              To:
            </span>

            {/* Chips */}
            {recipients.map((rcpt, idx) => (
              <div
                key={rcpt.email_address || rcpt.phone || idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: colors.accentLight,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: 16,
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span>{rcpt.display_name || rcpt.phone}</span>
                {rcpt.phone && rcpt.display_name !== rcpt.phone && (
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>({rcpt.phone})</span>
                )}
                {!initialDraft?.lockedRecipient && (
                  <button
                    type="button"
                    onClick={() => removeRecipient(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: colors.textSecondary,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: 0,
                    }}
                    title="Remove recipient"
                    aria-label={`Remove ${rcpt.display_name || rcpt.phone}`}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}

            {/* Input for adding new recipient */}
            {!initialDraft?.lockedRecipient ? (
              <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", position: "relative" }}>
                <input
                  ref={recipientInputRef}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: colors.textPrimary,
                    fontSize: 13,
                    width: "100%",
                    padding: "4px 0",
                  }}
                  placeholder={recipients.length === 0 ? "Type phone number (press Enter to add)" : "Add another..."}
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setRecipientError("");
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addRecipientByPhone();
                    } else if (e.key === "Backspace" && !recipientInput && recipients.length > 0) {
                      removeRecipient(recipients.length - 1);
                    }
                  }}
                />
                {lookingUp && (
                  <span style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 6 }}>
                    Checking…
                  </span>
                )}
              </div>
            ) : (
              <span style={{ marginLeft: "auto", color: colors.textSecondary, display: "flex" }} title={t("recipientLocked")}>
                <Lock size={14} strokeWidth={2} />
              </span>
            )}

            {/* Familiar recipients suggestions dropdown */}
            {showSuggestions && !initialDraft?.lockedRecipient && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 16,
                  right: 16,
                  marginTop: 4,
                  background: colors.surface,
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: 8,
                  boxShadow: "var(--shadow-sm)",
                  zIndex: 3000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: colors.textSecondary, background: colors.surfaceAlt, borderBottom: `1px solid ${colors.border}` }}>
                  Recent contacts
                </div>
                {filteredSuggestions.map((contact) => (
                  <div
                    key={contact.email_address || contact.phone}
                    onClick={() => addFamiliarRecipient(contact)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: `1px solid ${colors.border}`,
                      background: colors.surface,
                      transition: "background 100ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = colors.surface)}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                        {contact.display_name}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textSecondary }}>
                        {contact.phone || contact.email_address}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: colors.accent, fontWeight: 600 }}>+ Add</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline recipient validation error */}
          {recipientError && (
            <div
              style={{
                padding: "6px 16px",
                fontSize: 12,
                color: colors.danger,
                background: colors.dangerBg,
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{recipientError}</span>
              <button
                type="button"
                onClick={() => setRecipientError("")}
                style={{ background: "none", border: "none", color: colors.danger, cursor: "pointer", padding: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <input style={inputStyle} placeholder={t("subjectPlaceholder")} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus={Boolean(initialDraft?.lockedRecipient)} />

          {/* Assist Section */}
          <div style={{ borderBottom: `1px solid ${colors.border}`, background: colors.surface }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  background: showAssist ? colors.accentLight : colors.surfaceAlt,
                  color: colors.textAccent,
                  border: `1px solid ${showAssist ? colors.accent : colors.borderStrong}`,
                  borderRadius: 16, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
                onClick={() => { if (body.trim() && !showAssist) handleGenerateAssist(body); else { setShowAssist((p) => !p); setAssistError(""); } }}
                title={body.trim() ? "Draft polite version of my note" : "Writing assistant — drafts a message for you to edit"}
                disabled={assisting}
              >
                <Sparkles size={13} strokeWidth={2} />
                {assisting ? t("drafting") : t("helpMeWrite")}
              </button>

              {aiAssisted && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: colors.successBg, color: colors.success, border: `1px solid ${colors.success}`, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
                  <Sparkles size={11} strokeWidth={2} />
                  <span>{t("aiAssistedDraft")}</span>
                  <button type="button" className="icon-btn-danger" style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer", fontSize: 11, padding: "2px", display: "flex", borderRadius: 4 }} onClick={() => setAiAssisted(false)} title="Dismiss">
                    <X size={12} strokeWidth={2} color={colors.danger} />
                  </button>
                </div>
              )}
            </div>

            {showAssist && (
              <div style={{ padding: "8px 12px 10px 12px", background: colors.surfaceAlt, borderTop: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>Tap a common goal below, or type/speak a rough note:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ASSIST_INTENT_CHIPS.map((chip) => (
                    <button key={chip.id} type="button"
                      style={{ background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 14, padding: "4px 10px", fontSize: 12, color: colors.textMuted, cursor: "pointer", fontWeight: 500 }}
                      onClick={() => handleGenerateAssist(chip.intent)} disabled={assisting}
                    >{chip.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    style={{ flex: 1, border: `1px solid ${colors.borderStrong}`, borderRadius: 14, padding: "5px 12px", fontSize: 12, outline: "none", background: colors.surface, color: colors.textPrimary }}
                    placeholder="Or describe rough thoughts, e.g. ask when my appointment is…"
                    value={assistCustomIntent}
                    onChange={(e) => setAssistCustomIntent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (assistCustomIntent.trim()) handleGenerateAssist(assistCustomIntent); } }}
                    disabled={assisting}
                  />
                  <button type="button"
                    style={{ background: colors.accent, color: "var(--on-primary)", border: "none", borderRadius: 14, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                    onClick={() => handleGenerateAssist(assistCustomIntent || body)}
                    disabled={assisting || (!assistCustomIntent.trim() && !body.trim())}
                  >{assisting ? t("drafting") : "Draft"}</button>
                </div>
                {assistError && <p style={{ margin: 0, fontSize: 12, color: colors.danger }}>{assistError}</p>}
              </div>
            )}
          </div>

          <textarea style={textareaStyle} placeholder={t("messagePlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} />

          {/* Bracket placeholder resolver pills */}
          <PlaceholderResolverBar text={body} onChange={setBody} />

          {/* Listening banner */}
          {isListening && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.dangerBg, borderTop: `1px solid ${colors.danger}`, borderBottom: `1px solid ${colors.danger}`, padding: "8px 16px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.danger, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: colors.danger, flex: 1 }}>
                Listening in <strong>{VOICE_LANGUAGES.find((l) => l.code === voiceLang)?.name || "English"}</strong>… (transcribing live, edit anytime)
              </span>
              <button type="button" style={{ background: colors.danger, color: "var(--on-primary)", border: "none", borderRadius: 14, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }} onClick={handleVoiceToggle}>
                <MicOff size={13} strokeWidth={2} /> Stop
              </button>
            </div>
          )}

          {/* Attachment list */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 16px", background: colors.surfaceAlt, borderTop: `1px solid ${colors.border}` }}>
              {attachments.map((att, idx) => (
                <div key={att.id || idx} style={{ display: "flex", alignItems: "center", gap: 6, background: colors.accentLight, color: colors.textAccent, borderRadius: 16, padding: "4px 10px", fontSize: 12, fontWeight: 500 }}>
                  <Paperclip size={12} strokeWidth={2} />
                  <span>{att.filename} ({formatBytes(att.size)})</span>
                  <button type="button" className="icon-btn-danger" style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", borderRadius: 4 }} onClick={() => removeAttachment(idx)} title="Remove file">
                    <X size={12} strokeWidth={2} color={colors.danger} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ color: colors.danger, fontSize: 13, padding: "6px 16px", margin: 0 }} role="alert">{error}</p>}

          {/* Footer */}
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" style={{ background: colors.accent, color: "var(--on-primary)", border: "none", borderRadius: 20, padding: "8px 24px", cursor: (!body.trim() && attachments.length === 0) ? "default" : "pointer", opacity: (!body.trim() && attachments.length === 0) ? 0.5 : 1, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }} disabled={uploading || (!body.trim() && attachments.length === 0)}>
                <Send size={14} strokeWidth={2} />
                {t("send")}
              </button>

              <input type="file" multiple ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />

              <button type="button"
                style={{ background: colors.surfaceAlt, color: colors.textMuted, border: `1px solid ${colors.borderStrong}`, borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => fileInputRef.current?.click()} disabled={uploading} title={t("attachFile")}
              >
                <Paperclip size={13} strokeWidth={2} />
                {uploading ? "Uploading…" : t("attach")}
              </button>

              <button type="button"
                style={{
                  background:  isListening ? colors.danger       : colors.surfaceAlt,
                  color:       isListening ? "var(--on-primary)"              : colors.textPrimary,
                  border:      `1px solid ${isListening ? colors.danger : colors.borderStrong}`,
                  borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: isListening ? 600 : 500,
                  display: "flex", alignItems: "center", gap: 4,
                }}
                onClick={handleVoiceToggle}
                title={isListening ? "Stop voice input" : "Speak to transcribe into message body"}
                disabled={uploading}
              >
                {isListening ? <MicOff size={13} strokeWidth={2} /> : <Mic size={13} strokeWidth={2} />}
                {isListening ? "Listening…" : t("voice")}
              </button>

              <VoiceLanguageMenu
                value={voiceLang}
                onSelect={(newLang) => {
                  setVoiceLang(newLang);
                  saveSpeechLang(newLang);
                  if (isListening && recognitionRef.current) {
                    try { recognitionRef.current.stop(); } catch {}
                    setIsListening(false);
                  }
                }}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
