import React, { useState } from "react";
import { updateMe, addAlias } from "../api/client.js";

export default function Settings({ me, onBack, onUpdated }) {
  const [name, setName] = useState(me?.display_name || "");
  const [alias, setAlias] = useState("");
  const [aliases, setAliases] = useState(me?.aliases || []);
  const [error, setError] = useState("");

  const saveName = async () => {
    await updateMe(name);
    onUpdated({ ...me, display_name: name });
  };

  const submitAlias = async () => {
    setError("");
    try {
      const { data } = await addAlias(alias);
      setAliases(data.aliases);
      setAlias("");
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back to Mail</button>
        <h2>Profile & Settings</h2>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Email address</label>
        <p style={styles.readonly}>{me?.email_address}</p>

        <label style={styles.label}>Display name</label>
        <div style={styles.row}>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          <button style={styles.button} onClick={saveName}>Save</button>
        </div>

        <label style={styles.label}>Alias IDs</label>
        {aliases.map((a) => <p key={a} style={styles.readonly}>• {a}@phonemail.com</p>)}
        <div style={styles.row}>
          <input style={styles.input} placeholder="new-alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <button style={styles.button} onClick={submitAlias}>Add</button>
        </div>
        {error && <p style={{ color: "#d93025", fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: 32, maxWidth: 560, margin: "0 auto" },
  header: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 },
  backBtn: { alignSelf: "flex-start", border: "none", background: "none", color: "#1a73e8", cursor: "pointer", fontSize: 14 },
  card: { background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  label: { display: "block", fontSize: 12, color: "#5f6368", textTransform: "uppercase", marginTop: 16, marginBottom: 6 },
  readonly: { fontSize: 14, margin: "2px 0" },
  row: { display: "flex", gap: 8 },
  input: { flex: 1, padding: "8px 12px", border: "1px solid #dadce0", borderRadius: 6, fontSize: 14 },
  button: { border: "none", background: "#1a73e8", color: "#fff", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 14 },
};
