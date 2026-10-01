import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset, confirmPasswordReset } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import { styles } from "./Register.jsx";
import { APP_NAME } from "../config/brand.js";
import Logo from "../components/Logo.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { useI18n } from "../i18n/I18nContext.jsx";

/**
 * useWebOTP — listens for a one-time password from the browser's
 * credential manager (SMS OTP via WebOTP API).  Resolves once with the
 * 6-digit code, then cleans up.  Only fires when `active` is true so
 * we don't request credentials on every render.
 *
 * SMS must contain a line like:  "... @bharatchat.com #OTP-CODE"
 * (origin-bound OTP format — https://wicg.github.io/sms-one-time-codes/)
 */
function useWebOTP(onCode, active) {
  const abortRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    if (!("OTPCredential" in window) || !navigator.credentials) return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ctrl.signal })
      .then((cred) => { if (cred?.code) onCode(cred.code); })
      .catch(() => {}); // AbortError or unsupported — silently ignore

    return () => ctrl.abort();
  }, [active, onCode]);
}

export default function ForgotPassword() {
  const [step, setStep]               = useState("request");
  const [phone, setPhone]             = useState("");
  const [code, setCode]               = useState("");
  const [resetHint, setResetHint]     = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();
  const PW_ONLY = true; // password-only mode: no SMS reset codes
  const isNarrow = useIsMobile(1023);
  const { t } = useI18n();

  // Activate WebOTP only on the confirm step, not on request
  useWebOTP((autofilled) => setCode(autofilled), step === "confirm");

  const requestCode = async (e) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return setError(t("fpErrPhone"));
    setLoading(true);
    try {
      const { data } = await requestPasswordReset(digits);
      setResetHint(
        data.resetCode
          ? `Dev mode — code: ${data.resetCode}`
          : t("fpHint")
      );
      setStep("confirm");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("fpErrLen"));
    if (password !== confirmPassword) return setError(t("fpErrMatch"));
    setLoading(true);
    try {
      const digits = phone.replace(/[^\d]/g, "");
      await confirmPasswordReset(digits, code, password, confirmPassword);
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.page, padding: isNarrow ? 8 : styles.page.padding }}>
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Logo size={40} />
          <h1 style={{ ...styles.logo, margin: 0 }}>{APP_NAME}</h1>
        </div>
        {!PW_ONLY && <p style={styles.tagline}>{t("fpTagline")}</p>}

        {PW_ONLY ? (<p style={styles.hint} role="status">{t("fpNoSms")}</p>) : step === "request" ? (
          <form onSubmit={requestCode}>
            <label style={styles.label}>{t("fpPhone")}</label>
            <input
              style={styles.input}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              autoFocus
            />
            {error && <p style={styles.error} role="alert">{error}</p>}
            <button style={styles.button} disabled={loading}>
              {loading ? t("fpSending") : t("fpSend")}
            </button>
          </form>
        ) : (
          <form onSubmit={confirm}>
            <label style={styles.label}>{t("fpCode")}</label>
            {/*
              autocomplete="one-time-code" tells password managers and
              browsers to offer the SMS OTP.  WebOTP fills it automatically
              on supported browsers (Chrome Android, Safari 16+).
            */}
            <input
              style={styles.input}
              placeholder={t("fpCodePh")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
            />
            {resetHint && <p style={styles.hint}>{resetHint}</p>}
            <label style={styles.label}>{t("fpNewPw")}</label>
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
            <StrengthMeter password={password} />
            <label style={styles.label}>{t("fpConfirmPw")}</label>
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t("fpConfirmPw")}
              autoComplete="new-password"
            />
            {error && <p style={styles.error} role="alert">{error}</p>}
            <button style={styles.button} disabled={loading}>
              {loading ? t("fpSaving") : t("fpSet")}
            </button>
          </form>
        )}
        <p style={styles.switch}>
          <Link to="/login">{t("fpBack")}</Link>
        </p>
      </div>
    </div>
  );
}
