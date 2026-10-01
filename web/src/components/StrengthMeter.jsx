import React from "react";
import { passwordStrength } from "./passwordStrength.js";

export default function StrengthMeter({ password }) {
  const { label, color, percent } = passwordStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: -8, marginBottom: 16 }}>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: color, transition: "width 160ms ease" }} />
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color }}>{label}</p>
    </div>
  );
}
