import React, { useState } from "react";
import { setPassword } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import { styles } from "./Register.jsx";

export default function ChangePassword({ onDone }) {
  const [password, setPw] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await setPassword(password, confirmPassword);
      onDone();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>PhoneMail</h1>
        <p style={styles.tagline}>Choose a new password before you continue. Temporary passwords from SMS or phone signup must be changed.</p>
        <form onSubmit={submit}>
          <label style={styles.label}>New password</label>
          <PasswordField value={password} onChange={setPw} autoComplete="new-password" />
          <StrengthMeter password={password} />
          <label style={styles.label}>Confirm password</label>
          <PasswordField value={confirmPassword} onChange={setConfirm} placeholder="Confirm password" autoComplete="new-password" />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} disabled={loading}>{loading ? "Saving…" : "Save password"}</button>
        </form>
      </div>
    </div>
  );
}
