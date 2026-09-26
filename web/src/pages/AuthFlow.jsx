import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, registerAccount, setToken, acceptTos } from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import ChangePassword from "./ChangePassword.jsx";
import ThemedCheckbox from "../components/ThemedCheckbox.jsx";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
];

export default function AuthFlow({ initialMode = "login" }) {
  const { colors } = useTheme();
  const navigate = useNavigate();

  // Steps: 1: Language -> 2: Terms -> 3: Phone -> 4: Password
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(initialMode); // "login" | "register"

  // Language state
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem("phonemail_lang") || "English";
  });

  // Terms state
  const [termsAgreed, setTermsAgreed] = useState(false);

  // Phone state (prefill from session where possible)
  const [phone, setPhone] = useState(() => {
    return sessionStorage.getItem("phonemail_typed_phone") || "";
  });

  // Password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("phonemail_typed_phone", phone);
  }, [phone]);

  const handleSelectLang = (langLabel) => {
    setSelectedLang(langLabel);
    try {
      localStorage.setItem("phonemail_lang", langLabel);
    } catch {}
  };

  const handlePhoneSubmit = (e) => {
    e?.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) {
      setError("Please enter a valid phone number (at least 7 digits).");
      return;
    }
    setStep(4);
  };

  const handleAuthSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");

    if (mode === "register") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { data } = await registerAccount(digits, password, confirmPassword, true);
        setToken(data.token);
        await acceptTos().catch(() => {});
        if (data.mustChangePassword) setForceChange(true);
        else navigate("/");
      } else {
        const { data } = await login(digits, password);
        setToken(data.token);
        if (data.mustChangePassword) setForceChange(true);
        else navigate("/");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (forceChange) {
    return <ChangePassword onDone={() => navigate("/")} />;
  }

  // Common card style
  const cardStyle = {
    width: "100%",
    maxWidth: 460,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    color: colors.textPrimary,
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px 20px",
    background: colors.accent,
    color: "#fff",
    border: "none",
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s ease",
    marginTop: 16,
  };

  const secondaryBtnStyle = {
    ...buttonStyle,
    background: "none",
    border: `1px solid ${colors.borderStrong}`,
    color: colors.textPrimary,
    marginTop: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        padding: 20,
      }}
    >
      <div style={cardStyle}>
        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Step {step} of 4
          </span>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>PhoneMail</span>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: colors.dangerBg,
              color: colors.danger,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* ── STEP 1: Language Selection ────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🌐</div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: colors.textPrimary }}>Choose your language</h2>
              <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                Select your preferred language. You can change this later in Settings.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", margin: "16px 0", paddingRight: 4 }}>
              {LANGUAGES.map((l) => {
                const isSelected = selectedLang === l.label;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleSelectLang(l.label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: isSelected ? colors.accentLight : colors.surfaceAlt,
                      border: isSelected ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      color: isSelected ? colors.textAccent : colors.textPrimary,
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 15,
                    }}
                  >
                    <span>{l.label}</span>
                    {isSelected && <span style={{ color: colors.accent, fontSize: 16 }}>✓</span>}
                  </button>
                );
              })}
            </div>

            <button type="button" style={buttonStyle} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        )}

        {/* ── STEP 2: Terms and Conditions (Blocking) ───────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: colors.textPrimary }}>Terms &amp; Privacy Policy</h2>
              <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                Please review and accept the terms before continuing.
              </p>
            </div>

            <div
              style={{
                maxHeight: 260,
                overflowY: "auto",
                background: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.6,
                color: colors.textSecondary,
                marginBottom: 16,
              }}
            >
              <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary }}>What PhoneMail is</h4>
              <p style={{ margin: "0 0 12px 0" }}>
                PhoneMail provides an email address based directly on your phone number (&lt;yournumber&gt;@phonemail.com).
              </p>

              <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary }}>Your account</h4>
              <p style={{ margin: "0 0 12px 0" }}>
                You must be 13 or older to create an account. You are responsible for keeping your password secure.
              </p>

              <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary }}>Data we collect</h4>
              <ul style={{ margin: "0 0 12px 0", paddingLeft: 18 }}>
                <li>Phone number (your identity &amp; email address)</li>
                <li>Password (stored as a secure bcrypt hash)</li>
                <li>Email messages &amp; attachments (to power your inbox)</li>
              </ul>

              <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary }}>Privacy commitment</h4>
              <p style={{ margin: "0 0 12px 0" }}>
                We do not track your location, sell your data, or serve advertising.
              </p>

              <a
                href="/terms.html"
                target="_blank"
                rel="noreferrer"
                style={{ color: colors.accent, fontWeight: 600, textDecoration: "none" }}
              >
                Read full Terms of Service &amp; Privacy Policy ↗
              </a>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 13,
                cursor: "pointer",
                color: colors.textPrimary,
                userSelect: "none",
                marginBottom: 8,
              }}
            >
              <ThemedCheckbox
                checked={termsAgreed}
                onChange={(val) => setTermsAgreed(val)}
                size={18}
                style={{ marginTop: 2 }}
                ariaLabel="Agree to Terms of Service"
              />
              <span>
                I agree to PhoneMail's{" "}
                <a href="/terms.html" target="_blank" rel="noreferrer" style={{ color: colors.accent, fontWeight: 600 }}>
                  Terms of Service &amp; Privacy Policy
                </a>
              </span>
            </label>

            <button
              type="button"
              disabled={!termsAgreed}
              style={{
                ...buttonStyle,
                opacity: termsAgreed ? 1 : 0.45,
                cursor: termsAgreed ? "pointer" : "not-allowed",
              }}
              onClick={() => setStep(3)}
            >
              Agree and continue
            </button>

            <button type="button" style={secondaryBtnStyle} onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        )}

        {/* ── STEP 3: Phone Number Input ───────────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handlePhoneSubmit}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: colors.textPrimary }}>Enter your phone number</h2>
              <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                This becomes your PhoneMail email address.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase" }}>
                Phone Number
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: 10,
                  background: colors.surface,
                  padding: "0 14px",
                  fontSize: 16,
                }}
              >
                <span style={{ color: colors.textSecondary, marginRight: 8, fontWeight: 600 }}>+</span>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  autoComplete="tel"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    padding: "12px 0",
                    fontSize: 16,
                    background: "transparent",
                    color: colors.textPrimary,
                  }}
                />
              </div>
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: colors.textSecondary }}>
                Your address will be:{" "}
                <strong style={{ color: colors.accent }}>
                  {phone.replace(/[^\d]/g, "") || "..."}@phonemail.com
                </strong>
              </p>
            </div>

            <button type="submit" style={buttonStyle}>
              Next
            </button>

            <button type="button" style={secondaryBtnStyle} onClick={() => setStep(2)}>
              Back
            </button>
          </form>
        )}

        {/* ── STEP 4: Password Login / Creation ────────────────────────────── */}
        {step === 4 && (
          <form onSubmit={handleAuthSubmit}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: colors.textPrimary }}>
                {mode === "register" ? "Create your password" : "Enter your password"}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                Account: <strong style={{ color: colors.textPrimary }}>{phone.replace(/[^\d]/g, "")}@phonemail.com</strong>
              </p>
            </div>

            {/* Toggle Mode Tab (Sign In / Register) */}
            <div
              style={{
                display: "flex",
                background: colors.surfaceAlt,
                borderRadius: 8,
                padding: 3,
                marginBottom: 20,
              }}
            >
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: mode === "login" ? colors.surface : "transparent",
                  color: mode === "login" ? colors.textPrimary : colors.textSecondary,
                  fontWeight: mode === "login" ? 700 : 500,
                  cursor: "pointer",
                  fontSize: 13,
                  boxShadow: mode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: mode === "register" ? colors.surface : "transparent",
                  color: mode === "register" ? colors.textPrimary : colors.textSecondary,
                  fontWeight: mode === "register" ? 700 : 500,
                  cursor: "pointer",
                  fontSize: 13,
                  boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Create Account
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase" }}>
                Password
              </label>
              <PasswordField
                value={password}
                onChange={setPassword}
                autoFocus
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
              {mode === "register" && <StrengthMeter password={password} />}
            </div>

            {mode === "register" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase" }}>
                  Confirm Password
                </label>
                <PasswordField
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </div>
            )}

            {mode === "login" && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <Link to="/forgot-password" style={{ fontSize: 13, color: colors.accent, textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
            )}

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? "Please wait..." : mode === "register" ? "Create Account & Enter" : "Sign In"}
            </button>

            <button type="button" style={secondaryBtnStyle} onClick={() => setStep(3)}>
              Change Phone Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
