import React from "react";

const FOLDERS = [
  { key: "home", label: "Inbox & Sent", icon: "📥" },
  { key: "drafts", label: "Drafts", icon: "📝" },
  { key: "spam", label: "Spam", icon: "🚫" },
  { key: "trash", label: "Trash", icon: "🗑️" },
];

export default function Sidebar({ folder, onSelect, onCompose }) {
  return (
    <aside style={styles.sidebar}>
      <button style={styles.composeBtn} onClick={onCompose}>+ Compose</button>
      {FOLDERS.map((f) => (
        <div
          key={f.key}
          onClick={() => onSelect(f.key)}
          style={{ ...styles.item, ...(folder === f.key ? styles.itemActive : {}) }}
        >
          <span style={{ marginRight: 10 }}>{f.icon}</span>{f.label}
        </div>
      ))}
    </aside>
  );
}

const styles = {
  sidebar: { width: 220, borderRight: "1px solid #e0e0e0", padding: "16px 8px", background: "#fff" },
  composeBtn: {
    width: "100%", padding: "12px 16px", background: "#c2e7ff", border: "none", borderRadius: 20,
    fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 16,
  },
  item: { padding: "10px 16px", borderRadius: "0 20px 20px 0", cursor: "pointer", fontSize: 14, color: "#202124" },
  itemActive: { background: "#d3e3fd", fontWeight: 700 },
};
