import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  value,
  onChange,
  onInput,
  onKeyDown,
  placeholder = "Password",
  autoComplete,
  id,
  name,
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={styles.wrap}>
      <input
        id={id}
        name={name}
        style={styles.input}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={onInput}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        {...rest}
      />
      <button
        type="button"
        className="icon-btn"
        style={{ ...styles.toggle, zIndex: 2 }} onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

const styles = {
  wrap: { position: "relative", marginBottom: 16 },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 64px 12px 14px",
    fontSize: 15,
    fontFamily: "var(--font-sans)",
    background: "var(--c-surface-alt)",
    color: "var(--c-ink)",
    border: "1.5px solid var(--c-border-strong)",
    borderRadius: "var(--r-md, 10px)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  toggle: {
    position: "absolute",
    right: 4,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "none",
    color: "var(--primary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    width: 44,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-sm, 6px)",
  },
};
