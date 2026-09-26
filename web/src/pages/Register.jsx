import React from "react";
import AuthFlow from "./AuthFlow.jsx";

export const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f8fc", padding: 20 },
  card: { width: "100%", maxWidth: 440, background: "#ffffff", borderRadius: 12, padding: 32, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", boxSizing: "border-box" },
  logo: { fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#1E293B" },
  tagline: { fontSize: 14, color: "#64748B", margin: "0 0 24px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, marginTop: 16 },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" },
  button: { width: "100%", padding: "12px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 20 },
  error: { color: "#EF4444", fontSize: 13, marginTop: 8 },
  hint: { color: "#059669", fontSize: 13, marginTop: 6 },
  switch: { textAlign: "center", marginTop: 20, fontSize: 13, color: "#64748B" },
};

export default function Register() {
  return <AuthFlow initialMode="register" />;
}
