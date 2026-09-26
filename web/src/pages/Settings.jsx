import React, { useState } from "react";
import { updateMe, addAlias } from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { ArrowLeft, Moon, Sun, Check, Plus, Globe } from "lucide-react";
import ThemedSelect from "../components/ThemedSelect.jsx";

// ── Simple Toggle Switch component (wired, not a stub) ───────────────────────
function ToggleSwitch({ on, onToggle, id, colors }) {
  return (
    <div
      id={id}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? colors.switchTrackOn : colors.switchTrackOff,
        cursor: "pointer",
        transition: "background 0.2s",
        padding: 2,
        boxSizing: "border-box",
        flexShrink: 0,
        outline: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: colors.switchKnob,
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transform: on ? "translateX(20px)" : "translateX(0)",
          transition: "transform 0.2s",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export default function Settings({ me, onBack, onUpdated }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, lang, setLang, supportedLanguages } = useI18n();

  const [name, setName]     = useState(me?.display_name || "");
  const [alias, setAlias]   = useState("");
  const [aliases, setAliases] = useState(me?.aliases || []);
  const [error, setError]   = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const saveName = async () => {
    await updateMe(name);
    onUpdated({ ...me, display_name: name });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const submitAlias = async () => {
    setError("");
    try {
      const { data } = await addAlias(alias);
      setAliases(data.aliases);
      setAlias("");
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const inputStyle = {
    flex: 1,
    padding: "8px 12px",
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 6,
    fontSize: 14,
    background: colors.surface,
    color: colors.textPrimary,
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const buttonStyle = {
    border: "none",
    background: colors.accent,
    color: "#fff",
    borderRadius: 6,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "opacity 0.15s ease, transform 0.1s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginTop: 20,
    marginBottom: 6,
  };

  const readonlyStyle = { fontSize: 14, margin: "2px 0", color: colors.textPrimary };

  return (
    <div style={{ padding: 32, maxWidth: 560, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <button
          type="button"
          className="icon-btn"
          style={{
            alignSelf: "flex-start",
            border: "none",
            background: "none",
            color: colors.textAccent,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
          }}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          <span>{t("backToMail")}</span>
        </button>
        <h2 style={{ margin: 0, color: colors.textPrimary }}>{t("profileSettings")}</h2>
      </div>

      <div style={{ background: colors.surface, padding: 24, borderRadius: 8, border: `1px solid ${colors.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* Email address (read-only) */}
        <label style={labelStyle}>{t("emailAddress")}</label>
        <p style={readonlyStyle}>{me?.email_address}</p>

        {/* Display name */}
        <label style={labelStyle}>{t("displayName")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
          />
          <button
            type="button"
            className="btn-primary"
            style={buttonStyle}
            onClick={saveName}
          >
            {nameSaved ? (
              <>
                <Check size={14} />
                <span>{t("saved") || "Saved"}</span>
              </>
            ) : (
              t("save")
            )}
          </button>
        </div>

        {/* Alias IDs */}
        <label style={labelStyle}>{t("aliasIds")}</label>
        {aliases.map((a) => (
          <p key={a} style={readonlyStyle}>• {a}@phonemail.com</p>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            placeholder={t("newAlias") || "new-alias"}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitAlias(); }}
          />
          <button
            type="button"
            className="btn-primary"
            style={buttonStyle}
            onClick={submitAlias}
          >
            <Plus size={14} />
            <span>{t("add")}</span>
          </button>
        </div>
        {error && <p style={{ color: colors.danger, fontSize: 13, margin: "8px 0 0" }}>{error}</p>}

        {/* ── Language Preference ────────────────────────────────────────── */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>{t("language")}</label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={18} color={colors.textSecondary} />
              <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>{t("language")}</span>
            </div>
            <ThemedSelect
              value={lang}
              onChange={(newLang) => setLang(typeof newLang === "object" ? newLang.target.value : newLang)}
              options={supportedLanguages.map((l) => ({ value: l.code, label: l.label }))}
              triggerStyle={{
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 6,
                padding: "6px 12px",
                background: colors.surface,
                color: colors.textPrimary,
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* ── Appearance / Dark mode toggle ────────────────────────────────── */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>{t("appearance") || "Appearance"}</label>

          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", cursor: "pointer" }}
            onClick={toggleTheme}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isDark ? <Moon size={18} color={colors.textAccent} /> : <Sun size={18} color={colors.accent} />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  {t("darkMode")}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {isDark ? t("switchToLight") : t("switchToDark")}
                </div>
              </div>
            </div>
            <ToggleSwitch on={isDark} onToggle={toggleTheme} id="dark-mode-toggle" colors={colors} />
          </div>
        </div>

      </div>
    </div>
  );
}
