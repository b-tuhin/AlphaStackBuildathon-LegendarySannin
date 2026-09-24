import React, { useState } from "react";

export default function PasswordField({ value, onChange, placeholder = "Password", autoComplete, id }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={styles.wrap}>
      <input
        id={id}
        style={styles.input}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <button type="button" style={styles.toggle} onClick={() => setVisible((v) => !v)} tabIndex={-1}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

const styles = {
  wrap: { position: "relative", marginBottom: 16 },
  input: { width: "100%", padding: "10px 64px 10px 12px", fontSize: 15, border: "1px solid #dadce0", borderRadius: 6 },
  toggle: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "none",
    color: "#1a73e8",
    cursor: "pointer",
    fontSize: 13,
  },
};
