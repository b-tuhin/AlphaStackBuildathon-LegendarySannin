import React from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../api/client.js";

export default function TopBar({ query, onQueryChange, me, onOpenSettings }) {
  const navigate = useNavigate();
  const logout = () => { clearToken(); navigate("/register"); };

  return (
    <header style={styles.header}>
      <span style={styles.logo}>📧 PhoneMail</span>
      <input
        style={styles.search}
        placeholder="Search mail"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <div style={styles.right}>
        <span style={styles.email}>{me?.email_address}</span>
        <div style={styles.avatar} onClick={onOpenSettings} title="Profile & Settings">
          {(me?.display_name || me?.phone || "?").charAt(0).toUpperCase()}
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Log out</button>
      </div>
    </header>
  );
}

const styles = {
  header: { display: "flex", alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e0e0e0", gap: 16 },
  logo: { fontWeight: 700, fontSize: 18, color: "#5f6368", width: 180 },
  search: { flex: 1, padding: "10px 16px", borderRadius: 24, border: "none", background: "#eaf1fb", fontSize: 14 },
  right: { display: "flex", alignItems: "center", gap: 12 },
  email: { fontSize: 13, color: "#5f6368" },
  avatar: {
    width: 32, height: 32, borderRadius: 16, background: "#1a73e8", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, cursor: "pointer",
  },
  logoutBtn: { border: "1px solid #dadce0", background: "#fff", borderRadius: 16, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
};
