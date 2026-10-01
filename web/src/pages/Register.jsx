import React from "react";
import AuthFlow from "./AuthFlow.jsx";

export const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--c-bg)",
    padding: 20,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "var(--c-surface)",
    borderRadius: "var(--r-lg)",
    border: "1px solid var(--c-border)",
    padding: "32px 28px",
    boxShadow: "var(--shadow-md)",
    boxSizing: "border-box",
    color: "var(--c-ink)",
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 8px",
    color: "var(--c-ink)",
  },
  tagline: {
    fontSize: 14,
    color: "var(--c-ink-muted)",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--c-ink-muted)",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 14px",
    border: "1.5px solid var(--c-border-strong)",
    borderRadius: "var(--r-md)",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    background: "var(--c-surface-alt)",
    color: "var(--c-ink)",
    fontFamily: "var(--font-sans)",
  },
  button: {
    width: "100%",
    minHeight: 48,
    padding: "12px",
    background: "var(--primary)",
    color: "var(--on-primary)",
    border: "none",
    borderRadius: "var(--r-md)",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 20,
    fontFamily: "var(--font-sans)",
    transition: "background 0.15s ease, opacity 0.15s ease",
  },
  error: {
    color: "var(--c-danger)",
    fontSize: 13,
    marginTop: 8,
    background: "var(--c-danger-bg)",
    padding: "6px 10px",
    borderRadius: "var(--r-sm)",
  },
  hint: {
    color: "var(--c-success)",
    fontSize: 13,
    marginTop: 6,
    background: "var(--c-success-bg)",
    padding: "6px 10px",
    borderRadius: "var(--r-sm)",
  },
  switch: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 13,
    color: "var(--c-ink-muted)",
  },
};

export default function Register() {
  return <AuthFlow initialMode="register" />;
}
