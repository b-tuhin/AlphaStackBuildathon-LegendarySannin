import React from "react";

export default function EmailList({ emails, selectedId, onSelect }) {
  if (emails.length === 0) {
    return <div style={styles.empty}>No emails here.</div>;
  }
  return (
    <div style={styles.list}>
      {emails.map((e) => (
        <div
          key={e.id}
          onClick={() => onSelect(e)}
          style={{ ...styles.row, ...(selectedId === e.id ? styles.rowActive : {}), ...(e.is_read ? {} : styles.unread) }}
        >
          <span style={styles.from}>{e.from_address.split("@")[0]}</span>
          <span style={styles.subject}>{e.subject || "(no subject)"}</span>
          <span style={styles.preview}>— {e.body_text}</span>
          <span style={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  list: { flex: 1, overflowY: "auto", background: "#fff" },
  empty: { padding: 40, textAlign: "center", color: "#5f6368" },
  row: {
    display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f1f3f4",
    cursor: "pointer", fontSize: 14, gap: 8,
  },
  rowActive: { background: "#eaf1fb" },
  unread: { fontWeight: 700 },
  from: { width: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subject: { width: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  preview: { flex: 1, color: "#5f6368", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  date: { color: "#5f6368", fontSize: 12, width: 80, textAlign: "right" },
};
