import { EMAIL_DOMAIN } from "../config/brand.js";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, LogOut, User } from "lucide-react";
import { updateMe, addAlias, clearToken } from "../api/client.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getAvatarInitials, getAvatarColor } from "../utils/contact.js";
import ThemedSelect from "./ThemedSelect.jsx";
import ThemeToggle from "./ThemeToggle.jsx";


export default function AccountMenu({ me, isOpen, onClose, onUpdated }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, lang, setLang, supportedLanguages } = useI18n();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const [name, setName] = useState(me?.display_name || "");
  const [alias, setAlias] = useState("");
  const [aliases, setAliases] = useState(me?.aliases || []);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (me?.display_name) setName(me.display_name);
    if (me?.aliases) setAliases(me.aliases);
  }, [me]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !e.target.closest?.('[data-themed-select-menu="true"]') &&
        !e.target.closest?.('.themed-menu-scrollbar') &&
        !e.target.closest?.('[role="listbox"]') &&
        !e.target.closest?.('[role="option"]')
      ) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveName = async () => {
    try {
      await updateMe(name);
      if (onUpdated) onUpdated({ ...me, display_name: name });
      setSavedMsg(t("save") + "d!");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    }
  };

  const handleAddAlias = async (e) => {
    e?.preventDefault();
    setError("");
    if (!alias.trim()) return;
    try {
      const { data } = await addAlias(alias.trim().toLowerCase());
      setAliases(data.aliases);
      if (onUpdated) onUpdated({ ...me, aliases: data.aliases });
      setAlias("");
      setSavedMsg("Alias added!");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    }
  };

  const handleLangChange = (val) => {
    const code = typeof val === "object" ? (val.target?.value ?? val.value) : val;
    if (code) setLang(code);
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  const displayName = name || me?.phone || "You";
  const initials = getAvatarInitials(displayName);
  const avatarColor = getAvatarColor(me?.phone || me?.email_address);

  const inputStyle = {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.borderStrong}`,
    background: colors.surface,
    color: colors.textPrimary,
    fontSize: 14,
    outline: "none",
  };

  const sectionLabelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        width: 360,
        maxWidth: "calc(100vw - 32px)",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        boxShadow: "var(--shadow-sm)",
        zIndex: 1100,
        overflow: "hidden",
        color: colors.textPrimary,
      }}
    >
      {/* Header Profile Card */}
      <div
        style={{
          padding: "16px 20px",
          background: colors.surfaceAlt,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: avatarColor,
            color: "var(--on-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {me?.email_address}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn"
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, padding: 4, display: "flex" }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="themed-menu-scrollbar" style={{ padding: 20, maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {savedMsg && (
          <div style={{ padding: "8px 12px", background: colors.successBg, color: colors.success, borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
            {savedMsg}
          </div>
        )}
        {error && (
          <div style={{ padding: "8px 12px", background: colors.dangerBg, color: colors.danger, borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Display Name Edit */}
        <div>
          <label style={sectionLabelStyle}>{t("displayName")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              aria-label={t("displayName") || "Display Name"}
              style={{
                ...inputStyle,
                minHeight: 48,
                padding: "0 12px",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveName}
              aria-label={t("save") || "Save"}
              style={{
                minHeight: 48,
                minWidth: 80,
                boxSizing: "border-box",
                borderRadius: 8,
                border: "none",
                background: "var(--c-navy)",
                color: "var(--on-primary)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t("save") || "Save"}
            </button>
          </div>
        </div>

        {/* Alias IDs Management */}
        <div>
          <label style={sectionLabelStyle}>{t("aliasIds")}</label>
          {aliases.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {aliases.map((a) => (
                <span
                  key={a}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: colors.surfaceAlt,
                    fontSize: 12,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {a}@{EMAIL_DOMAIN}
                </span>
              ))}
            </div>
          )}
          <form onSubmit={handleAddAlias} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="new-alias"
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: colors.surfaceAlt,
                color: colors.textPrimary,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                border: `1px solid ${colors.border}`,
              }}
            >
              {t("add")}
            </button>
          </form>
        </div>

        {/* Language Preference — wired to real i18n context */}
        <div>
          <label style={sectionLabelStyle}>{t("language")}</label>
          <ThemedSelect
            value={lang}
            onChange={handleLangChange}
            options={supportedLanguages.map((l) => ({ value: l.code, label: l.label }))}
            style={{ width: "100%" }}
            triggerStyle={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.surface,
              color: colors.textPrimary,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Dark Mode Switch */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t("darkMode")}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{t("darkModeDesc")}</div>
          </div>
          <ThemeToggle id="account-menu-theme-toggle" />
        </div>

        {/* View Full Profile link (§7) */}
        <div style={{ paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surfaceAlt,
              color: colors.textPrimary,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <User size={15} strokeWidth={2} color={colors.accent} />
            <span>{t("viewFullProfile") || "View full profile"}</span>
          </button>
        </div>

        {/* Logout Button */}
        <div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: `1px solid ${colors.danger}`,
              background: "none",
              color: colors.danger,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.dangerBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            <LogOut size={15} strokeWidth={2} />
            {t("logOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
