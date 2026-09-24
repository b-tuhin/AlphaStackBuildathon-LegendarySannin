import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp, verifyOtp, setToken } from "../api/client.js";

export default function Register() {
  const [step, setStep] = useState("phone"); // phone -> otp
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const requestCode = async (e) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return setError("Enter a valid phone number.");
    setLoading(true);
    try {
      const { data } = await requestOtp(digits);
      setDevCode(data.devCode || "");
      setStep("otp");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const digits = phone.replace(/[^\d]/g, "");
      const { data } = await verifyOtp(digits, code);
      setToken(data.token);
      navigate("/");
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
        <p style={styles.tagline}>Your phone number is your email address.</p>

        {step === "phone" && (
          <form onSubmit={requestCode}>
            <label style={styles.label}>Phone number</label>
            <input
              style={styles.input}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} disabled={loading}>{loading ? "Sending…" : "Next"}</button>
            <p style={styles.tos}>
              By continuing, you agree to PhoneMail's{" "}
              <a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a>.
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verify}>
            <label style={styles.label}>Enter OTP sent to +{phone}</label>
            <input
              style={styles.input}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            {devCode && <p style={styles.hint}>Dev mode code: {devCode}</p>}
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} disabled={loading}>{loading ? "Verifying…" : "Next"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#fff", padding: "40px", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.15)", width: 360 },
  logo: { margin: 0, color: "#1a73e8" },
  tagline: { color: "#5f6368", marginTop: 4, marginBottom: 24 },
  label: { display: "block", fontSize: 13, color: "#5f6368", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #dadce0", borderRadius: 6, marginBottom: 16 },
  button: { width: "100%", padding: "10px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, cursor: "pointer" },
  error: { color: "#d93025", fontSize: 13, marginBottom: 12 },
  hint: { color: "#188038", fontSize: 13, marginBottom: 12 },
  tos: { fontSize: 12, color: "#5f6368", marginTop: 16 },
};
