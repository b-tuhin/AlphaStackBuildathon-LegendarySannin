import React, { useState } from "react";
import { setPassword } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";
import StrengthMeter from "../components/StrengthMeter.jsx";
import { styles } from "./Register.jsx";
import { APP_NAME } from "../config/brand.js";
import Logo from "../components/Logo.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function ChangePassword({ onDone }) {
  const [password, setPw] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isNarrow = useIsMobile(1023);
  const { t } = useI18n();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("fpErrLen"));
    if (password !== confirmPassword) return setError(t("fpErrMatch"));
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
    <div style={{ ...styles.page, padding: isNarrow ? 8 : styles.page.padding }}>
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Logo size={40} />
          <h1 style={{ ...styles.logo, margin: 0 }}>{APP_NAME}</h1>
        </div>
        <p style={styles.tagline}>{t("cpgTagline")}</p>
        <form onSubmit={submit}>
          <label style={styles.label}>{t("fpNewPw")}</label>
          <PasswordField value={password} onChange={setPw} autoComplete="new-password" />
          <StrengthMeter password={password} />
          <label style={styles.label}>{t("fpConfirmPw")}</label>
          <PasswordField value={confirmPassword} onChange={setConfirm} placeholder={t("fpConfirmPw")} autoComplete="new-password" />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} disabled={loading}>{loading ? t("fpSaving") : t("cpgSave")}</button>
        </form>
      </div>
    </div>
  );
}
