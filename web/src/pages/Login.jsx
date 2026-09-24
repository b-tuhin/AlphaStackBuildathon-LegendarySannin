import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setToken } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";
import ChangePassword from "./ChangePassword.jsx";
import { styles } from "./Register.jsx";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return setError("Enter a valid phone number.");
    setLoading(true);
    try {
      const { data } = await login(digits, password);
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
        <p style={styles.tagline}>Log in with your phone number and password.</p>
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
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
          <p style={{ margin: "-8px 0 16px", fontSize: 13, textAlign: "right" }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>
        <p style={styles.switch}>
          New to PhoneMail? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
