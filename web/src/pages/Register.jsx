import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerAccount, setToken } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import ChangePassword from "./ChangePassword.jsx";

export default function Register() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tos, setTos] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return setError("Enter a valid phone number.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!tos) return setError("Please accept the Terms of Service.");
    setLoading(true);
    try {
      const { data } = await registerAccount(digits, password, confirmPassword);
      setToken(data.token);
      if (data.mustChangePassword) setForceChange(true);
      else navigate("/");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (forceChange) return <ChangePassword onDone={() => navigate("/")} />;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>PhoneMail</h1>
        <p style={styles.tagline}>Create an account with your phone number and a password.</p>
        <form onSubmit={submit}>
          <label style={styles.label}>Phone number</label>
          <input
            style={styles.input}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            autoFocus
          />
          <label style={styles.label}>Password</label>
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <StrengthMeter password={password} />
          <label style={styles.label}>Confirm password</label>
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
            autoComplete="new-password"
          />
          <label style={styles.checkRow}>
            <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} />
            <span>
              I agree to PhoneMail's{" "}
              <a href="/terms.html" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
            </span>
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p style={styles.switch}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#fff", padding: "40px", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.15)", width: 360 },
  logo: { margin: 0, color: "#1a73e8" },
  tagline: { color: "#5f6368", marginTop: 4, marginBottom: 24 },
  label: { display: "block", fontSize: 13, color: "#5f6368", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #dadce0", borderRadius: 6, marginBottom: 16 },
  button: { width: "100%", padding: "10px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, cursor: "pointer" },
  error: { color: "#d93025", fontSize: 13, marginBottom: 12 },
  hint: { color: "#188038", fontSize: 13, marginBottom: 12 },
  checkRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#5f6368", marginBottom: 16 },
  switch: { fontSize: 13, color: "#5f6368", marginTop: 16, textAlign: "center" },
};
