import { EMAIL_DOMAIN } from "../config/brand.js";
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, registerAccount, startPhoneOtp, checkPhoneOtp, checkPhoneExists, setToken } from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { APP_NAME } from "../config/brand.js";
import { getAsset } from "../config/assets.js";
import Logo from "../components/Logo.jsx";
import AuthLanguageMenu from "../components/AuthLanguageMenu.jsx";
import TermsDialog from "../components/TermsDialog.jsx";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import ChangePassword from "./ChangePassword.jsx";
import ThemedCheckbox from "../components/ThemedCheckbox.jsx";
import { AlertCircle, Check, Globe, Smartphone } from "lucide-react";

const cleanPhone = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
};

export default function AuthFlow({ initialMode = "login" }) {
  const { colors } = useTheme();
  const { lang, setLang, supportedLanguages, t } = useI18n();
  const navigate = useNavigate();

  // Login goes directly to phone/password. Signup uses phone -> SMS code -> password.
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(initialMode); // "login" | "register"

  // Terms state
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Phone state (prefill from session where possible)
  const [phone, setPhone] = useState(() => {
    return cleanPhone(sessionStorage.getItem("phonemail_typed_phone") || "");
  });

  // Password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [signupGrant, setSignupGrant] = useState("");
  const [phoneOtpRequired, setPhoneOtpRequired] = useState(true);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("phonemail_typed_phone", phone);
  }, [phone]);

  const handlePhoneSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    const digits = phone.replace(/[^\d]/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t("phoneInvalid"));
      return;
    }
    let exists = null;
    setLoading(true);
    try { const r = await checkPhoneExists(phone); exists = !!r.data.exists; } catch { exists = null; } finally { setLoading(false); }
    if (exists === true) { setMode("login"); setSignupGrant(""); setOtpCode(""); setPhoneOtpRequired(true); setStep(4); return; }
    if (exists === false) setMode("register");
    if (exists === false || mode === "register") {
      setLoading(true);
      try {
        const { data } = await startPhoneOtp(phone, "signup");
        setOtpCode("");
        setSignupGrant("");
        setPhoneOtpRequired(data.mode !== "password");
        if (data.mode === "password") setStep(5);
        else { setResendSeconds(60); setStep(4); }
      } catch (err) {
        setError(err?.response?.data?.error || err.message || "Unable to send verification code.");
      } finally { setLoading(false); }
    } else {
      setStep(4);
    }
  };

  const handleOtpSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!/^\d{4,10}$/.test(otpCode)) { setError(t("afErrCode")); return; }
    setLoading(true);
    try {
      const { data } = await checkPhoneOtp(phone, otpCode, "signup");
      if (!data.signupGrant) throw new Error("Phone verification did not return a signup grant.");
      setSignupGrant(data.signupGrant);
      setOtpCode("");
      setStep(5);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Invalid or expired verification code.");
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    try {
      const { data } = await startPhoneOtp(phone, "signup");
      if (data.mode === "password") { setPhoneOtpRequired(false); setStep(5); return; }
      setResendSeconds(60); setOtpCode("");
    }
    catch (err) { setError(err?.response?.data?.error || err.message || "Unable to resend code."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const handleAuthSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (mode === "register") {
      if (phoneOtpRequired && !signupGrant) { setError(t("afErrVerify")); return; }
      if (password.length < 8) { setError(t("fpErrLen")); return; }
      if (password !== confirmPassword) { setError(t("fpErrMatch")); return; }
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const { data } = await registerAccount(phone, password, confirmPassword, true, signupGrant);
        setToken(data.token);
        sessionStorage.removeItem("phonemail_typed_phone");
        setPhone(""); setPassword(""); setConfirmPassword(""); setOtpCode(""); setSignupGrant("");
        if (data.mustChangePassword) setForceChange(true);
        else navigate("/");
      } else {
        const { data } = await login(phone, password);
        setToken(data.token);
        if (data.mustChangePassword) setForceChange(true);
        else navigate("/");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Authentication failed");
    } finally { setLoading(false); }
  };

  if (forceChange) {
    return <ChangePassword onDone={() => navigate("/")} />;
  }

  return (
    <div className="login-page-viewport">
      {/* ── Full-Bleed Atmospheric Background Layer (Phase 2 Spec) ── */}
      <div className="login-bg-layer" aria-hidden="true">
        <picture className="login-bg-picture">
          <source media="(max-width: 768px)" srcSet={getAsset("login-mobile").url} />
          <img
            src={getAsset("login-desktop").url}
            alt=""
            className="login-bg-img"
            style={{ objectPosition: getAsset("login-desktop").objectPosition }}
            loading="eager"
            decoding="async"
          />
        </picture>
      </div>

      {/* ── Content Container: Desktop form sits on RIGHT over the image ── */}
      <div className="login-content-container">
        <main className="login-card" id="main-content">
          <div className="login-sheet-handle" aria-hidden="true" />
          {/* Header & Step Indicator */}
          <div className="auth-card-header">
            <div className="auth-card-brand">
              <Logo size={72} />
              <span className="auth-card-brand-name">{APP_NAME}</span>
            </div>

            
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--link)", background: "var(--primary-tint)",
                padding: "3px 9px",
                borderRadius: 12,
                letterSpacing: "0.3px",
              }}
            >
              {t("afStepOf").replace("{n}", step).replace("{total}", mode === "register" ? 5 : 4)}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: 4,
              background: "var(--raised)",
              borderRadius: 2,
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round((step / (mode === "register" ? 5 : 4)) * 100)}%`,
                height: "100%",
                background: "var(--primary)", borderRadius: 2, transition: "width 240ms ease",
              }}
            />
          </div>

          {/* Error Banner with standard alert semantics */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="pm-alert pm-alert--error" style={{ marginBottom: 18, borderRadius: "var(--r-md)", fontSize: 13, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
            >
              <AlertCircle size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div key={step} className="auth-step-anim">
            {/* ── STEP 1: Language Selection ────────────────────────────────────── */}
            {step === 1 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div
                    className="login-step-icon-circle"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--primary-tint)",
                      color: "var(--link)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px auto",
                    }}
                  >
                    <Globe size={24} strokeWidth={1.75} color="var(--link)" />
                  </div>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
                    {t("chooseLanguage") || "Choose your language"}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                    {t("chooseLanguageDesc") || "Select your preferred language. You can change this later in Settings."}
                  </p>
                </div>

                <div
                  className="chat-scroll-container language-scroll-area" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 208,
                    overflowY: "auto",
                    margin: "18px 0",
                    paddingRight: 4,
                  }}
                >
                  {supportedLanguages.map((l) => {
                    const isSelected = lang === l.code;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setLang(l.code)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: 52, height: 52, padding: "0 16px", background: isSelected ? "var(--primary-tint)" : "var(--surface)", border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                          borderRadius: "var(--r-md)",
                          cursor: "pointer",
                          textAlign: "left",
                          color: isSelected ? "var(--link)" : "var(--text)",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 15,
                          fontFamily: "var(--font-sans)",
                          transition: "all 0.15s ease",
                          boxSizing: "border-box",
                        }}
                      >
                        <span>{l.label}</span>
                        {isSelected && (
                          <Check size={18} strokeWidth={2.5} color="var(--primary)" style={{ flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setStep(2)}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    height: 48,
                    background: "var(--primary)",
                    color: "var(--on-primary)",
                    borderRadius: "var(--r-md)",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {t("continue") || "Continue"}
                </button>
              </div>
            )}

            {/* ── STEP 2: Terms and Conditions ─────────────────────────────────── */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
                    {t("afTermsTitle")}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                    {t("afTermsIntro")}
                  </p>
                </div>

                <div
                  className="chat-scroll-container"
                  style={{
                    maxHeight: 240,
                    overflowY: "auto",
                    background: "var(--c-surface-alt)",
                    border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-md)",
                    padding: 16,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: colors.textSecondary,
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>
                    What {APP_NAME} is
                  </h4>
                  <p style={{ margin: "0 0 12px 0" }}>
                    {APP_NAME} provides an official civic email address based directly on your phone number (&lt;yournumber&gt;@{EMAIL_DOMAIN}).
                  </p>

                  <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>
                    {t("afPrivacyHead")}
                  </h4>
                  <p style={{ margin: "0 0 12px 0" }}>
                    {t("afPrivacyBody")}
                  </p>

                  <h4 style={{ margin: "0 0 4px 0", color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>
                    {t("afDataHead")}
                  </h4>
                  <ul style={{ margin: "0 0 12px 0", paddingLeft: 18 }}>
                    <li>{t("afData1")}</li>
                    <li>{t("afData2")}</li>
                    <li>{t("afData3")}</li>
                  </ul>

                  <a
                    href="/terms.html"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--c-navy)", fontWeight: 600, textDecoration: "none" }}
                  >
                    {t("afReadFull")} ↗
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
                    marginBottom: 16,
                    lineHeight: 1.4,
                  }}
                >
                  <ThemedCheckbox
                    checked={termsAgreed}
                    onChange={(val) => setTermsAgreed(val)}
                    size={20}
                    style={{ marginTop: 1 }}
                    ariaLabel="Agree to Terms of Service"
                  />
                  <span>
                    I agree to {APP_NAME}'s{" "}
                    <a href="/terms.html" target="_blank" rel="noreferrer" style={{ color: "var(--c-navy)", fontWeight: 600 }}>
                      {t("afTosLink")}
                    </a>
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!termsAgreed}
                  className="btn-primary"
                  onClick={() => setStep(3)}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    height: 48,
                    background: "var(--primary)",
                    color: "var(--on-primary)",
                    borderRadius: "var(--r-md)",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {t("afAgree")}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
              </div>
            )}

            {/* ── STEP 3: Phone Number Input ───────────────────────────────────── */}
            {step === 3 && (
              <form onSubmit={handlePhoneSubmit}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div
                    className="login-step-icon-circle"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--primary-tint)",
                      color: "var(--link)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px auto",
                    }}
                  >
                    <Smartphone size={24} strokeWidth={1.75} color="var(--link)" />
                  </div>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
                    {t("afPhoneTitle")}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                    {t("afPhoneDesc").replace("{app}", APP_NAME)}
                  </p>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label
                    htmlFor="phone"
                    className="pm-label"
                    style={{ marginTop: 0 }}
                  >
                    {t("afPhoneLabel")}
                  </label>
                  <div className="login-input-wrap">
                    <span
                      aria-hidden="true"
                      style={{ alignSelf: "stretch", display: "flex", alignItems: "center", padding: "0 14px", background: "var(--raised)", border: "1px solid var(--border)", borderRadius: "var(--r-md) 0 0 var(--r-md)", color: colors.textPrimary, fontSize: 16, fontWeight: 600, fontFamily: "var(--font-sans)" }}
                    >+91</span>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      onPaste={(e) => { e.preventDefault(); setPhone(cleanPhone(e.clipboardData.getData("text"))); }}
                      inputMode="numeric"
                      maxLength={10}
                      autoFocus
                      autoComplete="tel-national"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        outline: "none",
                        padding: "14px 16px 14px 12px",
                        fontSize: 16,
                        background: "transparent",
                        color: colors.textPrimary,
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 12px",
                      borderRadius: "var(--r-sm)",
                      background: "var(--c-surface-alt)",
                      fontSize: 12,
                      color: colors.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{t("afAddrWill")}</span>
                    <strong style={{ color: "var(--c-navy)", fontWeight: 700 }}>
                      {(phone.replace(/[^\d]/g, "").length === 10 ? `91${phone.replace(/[^\d]/g, "")}` : phone.replace(/[^\d]/g, "")) || "..."}@{EMAIL_DOMAIN}
                    </strong>
                  </div>
                </div>

                {mode === "register" && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "4px 0 16px", fontSize: 13, lineHeight: 1.4, color: "var(--text)" }}>
                    <ThemedCheckbox
                      checked={termsAgreed}
                      onChange={(val) => setTermsAgreed(val)}
                      size={20}
                      style={{ marginTop: 1 }}
                      ariaLabel={t("termsAgreePrefix") + " " + t("termsLinkText")}
                    />
                    <span>
                      {t("termsAgreePrefix")}{" "}
                      <button type="button" className="terms-link" onClick={() => setTermsOpen(true)}>{t("termsLinkText")}</button>
                    </span>
                  </div>
                )}
                <button type="submit" disabled={loading || (mode === "register" && !termsAgreed)} className="btn-primary" style={{ width: "100%", minHeight: 48, height: 48, background: "var(--primary)", color: "var(--on-primary)", borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600 }}>
                  {loading ? t("afWait") : t("afNext")}
                </button>
                {mode === "login" && (
                  <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.4, textAlign: "center", color: colors.textSecondary }}>
                    {t("termsFootnotePrefix")}{" "}
                    <button type="button" className="terms-link" onClick={() => setTermsOpen(true)}>{t("termsLinkText")}</button>
                  </p>
                )}
                <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />

                {mode === "register" && <button type="button" className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => { setMode("login"); setPhoneOtpRequired(true); setSignupGrant(""); setStep(3); }}>{t("afHaveAccount")}</button>}
              </form>
            )}

            {/* Signup OTP entry; login skips this step. */}
            {step === 4 && mode === "register" && !signupGrant && (
              <form onSubmit={handleOtpSubmit}>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{t("afCodeTitle")}</h2>
                <p>We sent a one-time code to {phone}. Your browser may offer to autofill it.</p>
                <input name="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} autoFocus />
                <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", minHeight: 48, marginTop: 16 }}>{loading ? t("afWait") : t("afNext")}</button>
                <button type="button" disabled={loading || resendSeconds > 0} className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={handleResendOtp}>{resendSeconds ? `Resend code in ${resendSeconds}s` : "Resend code"}</button>
              </form>
            )}

            {/* Login is step 4; verified signup sets its password in step 5. */}
            {((step === 4 && mode === "login") || (step === 5 && mode === "register" && (!phoneOtpRequired || signupGrant))) && (
              <form onSubmit={handleAuthSubmit}>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
                    {mode === "register" ? t("afCreatePw") : t("afEnterPw")}
                  </h2>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--c-navy-light)",
                      color: "var(--c-navy)",
                      padding: "4px 10px",
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span>{t("afAccount")}</span>
                    <strong>{(phone.replace(/[^\d]/g, "").length === 10 ? `91${phone.replace(/[^\d]/g, "")}` : phone.replace(/[^\d]/g, ""))}@{EMAIL_DOMAIN}</strong>
                  </div>
                </div>

                {/* Mode Selector Tab (Sign In / Create Account) */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="password"
                    className="pm-label"
                    style={{ marginTop: 0 }}
                  >
                    {t("afPassword")}
                  </label>
                  <PasswordField
                    id="password"
                    name="password"
                    value={password}
                    onChange={setPassword}
                    autoFocus
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                  />
                  {mode === "register" && <StrengthMeter password={password} />}
                </div>

                {mode === "register" && (
                  <div style={{ marginBottom: 18 }}>
                    <label
                      htmlFor="confirmPassword"
                      className="pm-label"
                      style={{ marginTop: 0 }}
                    >
                      {t("afConfirmPw")}
                    </label>
                    <PasswordField
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t("afConfirmPh")}
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {mode === "login" && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <Link
                      to="/forgot-password"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--c-navy)",
                        textDecoration: "none",
                      }}
                    >
                      {t("afForgot")}
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    minHeight: 48,
                    height: 48,
                    background: "var(--primary)",
                    color: "var(--on-primary)",
                    borderRadius: "var(--r-md)",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {loading ? t("afWait") : mode === "register" ? t("afCreateEnter") : t("afSignIn")}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => { setSignupGrant(""); setOtpCode(""); setPhoneOtpRequired(true); setStep(3); }}
                >
                  {t("afChangePhone")}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
