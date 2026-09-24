import React, { useState } from "react";
import { sendMail } from "../api/client.js";

export default function ComposeModal({ onClose, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setError("");
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (recipients.length === 0) return setError("Add at least one recipient.");
    setSending(true);
    try {
      await sendMail({ to: recipients.length > 1 ? recipients : recipients[0], subject, text: body });
      onSent();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span>New message</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <input style={styles.input} placeholder="To (phone or number, comma-separated for a group)" value={to} onChange={(e) => setTo(e.target.value)} />
        <input style={styles.input} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea style={styles.textarea} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.footer}>
          <button style={styles.sendBtn} onClick={send} disabled={sending}>{sending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24 },
  modal: { width: 480, background: "#fff", borderRadius: "8px 8px 0 0", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#f2f6fc", fontWeight: 600 },
  closeBtn: { border: "none", background: "none", cursor: "pointer", fontSize: 14 },
  input: { border: "none", borderBottom: "1px solid #eee", padding: "10px 16px", fontSize: 14 },
  textarea: { border: "none", padding: "10px 16px", fontSize: 14, minHeight: 200, resize: "vertical" },
  error: { color: "#d93025", fontSize: 13, padding: "0 16px" },
  footer: { padding: "10px 16px" },
  sendBtn: { background: "#1a73e8", color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", cursor: "pointer", fontWeight: 600 },
};
