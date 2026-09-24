import React from "react";
import { updateEmail } from "../api/client.js";

export default function EmailView({ email, onReplySent, refreshList }) {
  if (!email) return <div style={styles.empty}>Select an email to read it.</div>;

  const act = async (patch) => {
    await updateEmail(email.id, patch);
    refreshList();
  };

  return (
    <div style={styles.pane}>
      <div style={styles.toolbar}>
        <button style={styles.iconBtn} title="Move to trash" onClick={() => act({ folder: "trash" })}>🗑️</button>
        <button style={styles.iconBtn} title="Mark as spam" onClick={() => act({ folder: "spam" })}>🚫</button>
        <button style={styles.iconBtn} title="Favorite" onClick={() => act({ is_favorite: email.is_favorite ? 0 : 1 })}>
          {email.is_favorite ? "★" : "☆"}
        </button>
      </div>
      <h2 style={styles.subject}>{email.subject || "(no subject)"}</h2>
      <div style={styles.meta}>
        <strong>{email.from_address}</strong> → {email.to_address}
        <span style={styles.date}>{new Date(email.created_at).toLocaleString()}</span>
      </div>
      <p style={styles.body}>{email.body_text}</p>
    </div>
  );
}

const styles = {
  pane: { flex: 1, padding: 24, overflowY: "auto", background: "#fff" },
  empty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#5f6368" },
  toolbar: { display: "flex", gap: 8, marginBottom: 16 },
  iconBtn: { border: "none", background: "none", fontSize: 18, cursor: "pointer" },
  subject: { margin: "0 0 8px 0" },
  meta: { color: "#5f6368", fontSize: 13, marginBottom: 20, display: "flex", justifyContent: "space-between" },
  date: { color: "#5f6368" },
  body: { fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" },
};
