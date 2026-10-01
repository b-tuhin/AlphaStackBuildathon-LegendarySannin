import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  Plus,
  Globe,
  KeyRound,
  LogOut,
  ShieldCheck,
  Trash2,
  User,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { getMe, updateMe, updateMyAvatar, uploadAttachment, addAlias, deleteAlias, clearToken, changePassword } from "../api/client.js";
import { getAsset } from "../config/assets.js";
import { Upload as UploadIcon, Trash2 as TrashIcon } from "lucide-react";
import { squareResize } from "../utils/image.js";
import Avatar from "../components/Avatar.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getAvatarInitials, getAvatarColor, formatPhoneNumber } from "../utils/contact.js";
import { EMAIL_DOMAIN } from "../config/brand.js";
import ThemedSelect from "../components/ThemedSelect.jsx";
import Logo from "../components/Logo.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";

import { Image as ImageIcon } from "lucide-react";

// ── Wallpaper Picker — loaded from /assets/wallpapers/manifest.json ─────────
// Saving uses localStorage key "chatWallpaper" (the wallpaper *file* path, or null).
// A CustomEvent "chatWallpaperChange" notifies ChatView in the same tab immediately.
function WallpaperPickerSection({ colors }) {
  const [manifest, setManifest] = useState([]);
  const [selected, setSelected] = useState(() => {
    try { return localStorage.getItem("chatWallpaper") || null; } catch { return null; }
  });

  useEffect(() => {
    fetch("/assets/wallpapers/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setManifest(data);
      })
      .catch(() => {}); // silently ignore fetch errors
  }, []);

  const pick = (fileOrNull) => {
    setSelected(fileOrNull || "none");
    try {
      localStorage.setItem("chatWallpaper", fileOrNull || "none");
    } catch {}
    // Notify ChatView in same tab immediately (storage event only fires cross-tab)
    try {
      window.dispatchEvent(new CustomEvent("chatWallpaperChange", { detail: fileOrNull || "none" }));
    } catch {}
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  };

  const on = selected !== "none";
  const firstFile = (manifest.find((w) => w.file && w.enabled !== false) || {}).file || null;
  const toggleWallpaper = () => {
    if (on) pick(null);
    else if (firstFile) pick(firstFile);
  };

  return (
    <>
      <label style={labelStyle}>
        <ImageIcon size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />
        Chat Background
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, color: colors.textPrimary }}>Show wallpaper in chats</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show wallpaper in chats"
          disabled={!on && !firstFile}
          onClick={toggleWallpaper}
          style={{
            position: "relative",
            width: 44,
            height: 24, minHeight: 24, maxHeight: 24, maxWidth: 44, boxSizing: "border-box", minWidth: 44,
            padding: 0,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            background: on ? "var(--primary)" : "var(--border-strong)",
            transition: "background 150ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--on-primary)",
              transform: on ? "translateX(20px)" : "translateX(0)",
              transition: "transform 150ms ease",
            }}
          />
        </button>
      </div>
    </>
  );
}
export default function Settings({ me: initialMe, onBack, onUpdated }) {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { t, lang, setLang, supportedLanguages } = useI18n();
  const navigate = useNavigate();
  const isNarrow = useIsMobile(1023);

  const [me, setMe] = useState(initialMe || null);
  const [name, setName] = useState(initialMe?.display_name || "");
  const [alias, setAlias] = useState("");
  const [aliases, setAliases] = useState(initialMe?.aliases || []);
  const [error, setError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [presetId, setPresetId] = useState(null);
  const [showCp, setShowCp] = useState(false);
  const [cpCur, setCpCur] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConf, setCpConf] = useState("");
  const [cpMsg, setCpMsg] = useState("");
  const [cpErr, setCpErr] = useState("");
  const [cpBusy, setCpBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null); // instant local preview while uploading
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!me) {
      getMe()
        .then(({ data }) => {
          setMe(data);
          setName(data.display_name || "");
          setAliases(data.aliases || []);
        })
        .catch(() => {});
    }
  }, [me]);

  useEffect(() => {
    if (initialMe) {
      setMe(initialMe);
      setName(initialMe.display_name || "");
      setAliases(initialMe.aliases || []);
    }
  }, [initialMe]);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate("/");
  };

  const saveName = async () => {
    try {
      await updateMe(name);
      const updated = { ...me, display_name: name };
      setMe(updated);
      if (onUpdated) onUpdated(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const applyAvatar = (data, preview) => {
    setAvatarPreview(preview);
    const updated = { ...me, avatar_id: data?.avatar_id ?? null, avatar_url: data?.avatar_url ?? null };
    setMe(updated);
    if (onUpdated) onUpdated(updated);
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setAvatarBusy(true);
    try {
      const square = await squareResize(file);
      const preview = URL.createObjectURL(square);
      setAvatarPreview(preview);
      const { data: uploaded } = await uploadAttachment(square);
      const { data } = await updateMyAvatar(uploaded.id);
      applyAvatar(data, preview);
    } catch (err) {
      setAvatarPreview(null);
      setError(err?.response?.data?.error || err.message || "Could not update your profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitChangePw = async () => {
    setCpErr("");
    setCpMsg("");
    setCpBusy(true);
    try {
      await changePassword(cpCur, cpNew, cpConf);
      setCpMsg(t("cpDone"));
      setCpCur("");
      setCpNew("");
      setCpConf("");
    } catch (err) {
      setCpErr(err?.response?.data?.error || err.message || "Could not change password.");
    } finally {
      setCpBusy(false);
    }
  };

  const handlePresetAvatar = async (id) => {
    setError("");
    setPresetId(id);
    setShowAvatarMenu(false);
    try {
      const res = await fetch(getAsset(id).url);
      const blob = await res.blob();
      const file = new File([blob], id + ".png", { type: blob.type || "image/png" });
      await handleAvatarFile({ target: { files: [file], value: "" } });
    } catch (err) {
      setError(err?.message || "Could not set this avatar.");
    }
  };

  const handleAvatarRemove = async () => {
    setError("");
    setAvatarBusy(true);
    try {
      const { data } = await updateMyAvatar(null);
      applyAvatar(data, null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Could not remove your profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitAlias = async () => {
    setError("");
    if (!alias.trim()) return;
    try {
      const { data } = await addAlias(alias.trim().toLowerCase());
      const updatedAliases = data.aliases || [...aliases, alias.trim().toLowerCase()];
      setAliases(updatedAliases);
      const updated = { ...me, aliases: updatedAliases };
      setMe(updated);
      if (onUpdated) onUpdated(updated);
      setAlias("");
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const handleDeleteAlias = async (aliasToDelete) => {
    setError("");
    try {
      const { data } = await deleteAlias(aliasToDelete);
      const updatedAliases = data.aliases || aliases.filter((a) => a !== aliasToDelete);
      setAliases(updatedAliases);
      const updated = { ...me, aliases: updatedAliases };
      setMe(updated);
      if (onUpdated) onUpdated(updated);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  const displayName = name || me?.phone || "User";
  const avatarKey = me?.phone || me?.email_address;
  const avatarSrc = avatarPreview || me?.avatar_url || null;

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    padding: "0 14px",
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    fontSize: 14,
    background: colors.surface,
    color: colors.textPrimary,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
  };

  const buttonStyle = {
    minHeight: 48,
    minWidth: 96,
    boxSizing: "border-box",
    border: "none",
    borderRadius: 8,
    padding: "0 18px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
    transition: "background 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 20,
    marginBottom: 6,
  };

  const readonlyStyle = {
    fontSize: 14,
    margin: "4px 0",
    color: colors.textPrimary,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        color: colors.textPrimary,
        padding: isNarrow ? "8px" : "24px 16px 48px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Navigation Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 64, marginBottom: 16 }}>
        <button
          type="button"
          className="btn-text"
          style={{ color: "var(--link)", whiteSpace: "nowrap" }}
          onClick={handleBack}
        >
          <ArrowLeft size={18} />
          <span>{t("backToMail") || "Back to Mail"}</span>
        </button>
          <Logo size={32} />
        </div>

        {/* Profile Card Container with Header Band (§7) */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border)",
            padding: 24,
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Avatar and Primary Identity */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar
                  src={avatarSrc}
                  name={displayName}
                  colorKey={avatarKey}
                  size={80}
                  fontSize={28}
                  style={{
                    border: `4px solid ${colors.surface}`,
                    boxShadow: "var(--shadow-sm)",
                    opacity: avatarBusy ? 0.6 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                />
                <button
                  type="button"
                  data-ui-exempt="true"
                  className="avatar-edit-btn"
                  onClick={() => setShowAvatarMenu((v) => !v)}
                  disabled={avatarBusy}
                  title="Change profile picture"
                  aria-label="Change profile picture"
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: `3px solid ${colors.surface}`,
                    background: colors.accent,
                    color: "var(--on-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: avatarBusy ? "wait" : "pointer",
                    padding: 0,
                  }}
                >
                  <Camera size={14} strokeWidth={2.2} />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFile}
                  style={{ display: "none" }}
                />
                {showAvatarMenu && (
                  <>
                    <div onClick={() => setShowAvatarMenu(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} />
                    <div style={{ position: "absolute", top: 92, left: 0, width: 340, maxWidth: "calc(100vw - 48px)", boxSizing: "border-box", zIndex: 41, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", padding: 12 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={() => { setShowAvatarMenu(false); avatarInputRef.current && avatarInputRef.current.click(); }} style={{ flex: 1, minWidth: 0, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface)", color: colors.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          <UploadIcon size={22} strokeWidth={2} color={colors.accent} /><span>{t("uploadPhoto")}</span>
                        </button>
                        <button type="button" disabled={!avatarSrc} onClick={() => { setPresetId(null); setShowAvatarMenu(false); handleAvatarRemove(); }} style={{ flex: 1, minWidth: 0, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface)", color: colors.textPrimary, fontSize: 13, fontWeight: 600, cursor: avatarSrc ? "pointer" : "not-allowed", opacity: avatarSrc ? 1 : 0.4 }}>
                          <TrashIcon size={22} strokeWidth={2} color={colors.textSecondary} /><span>{t("removePhoto")}</span>
                        </button>
                      </div>
                      <div style={{ margin: "12px 0 8px 0", fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>{t("chooseAvatar")}</div>
                      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                        <button type="button" onClick={() => handlePresetAvatar("avatar-girl")} title={t("avatarGirlLabel")} aria-label={t("avatarGirlLabel")} style={{ width: 80, height: 80, minWidth: 80, minHeight: 80, maxWidth: 80, maxHeight: 80, flexShrink: 0, padding: 0, borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "transparent", border: presetId === "avatar-girl" ? "2px solid var(--primary)" : "2px solid transparent" }}>
                          <img src={getAsset("avatar-girl").url} alt={t("avatarGirlLabel")} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                        <button type="button" onClick={() => handlePresetAvatar("avatar-boy")} title={t("avatarBoyLabel")} aria-label={t("avatarBoyLabel")} style={{ width: 80, height: 80, minWidth: 80, minHeight: 80, maxWidth: 80, maxHeight: 80, flexShrink: 0, padding: 0, borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "transparent", border: presetId === "avatar-boy" ? "2px solid var(--primary)" : "2px solid transparent" }}>
                          <img src={getAsset("avatar-boy").url} alt={t("avatarBoyLabel")} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: colors.successBg,
                  color: colors.success,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: `1px solid color-mix(in srgb, ${colors.success} 25%, transparent)`,
                }}
              >
                <ShieldCheck size={14} strokeWidth={2.2} />
                <span>Active Account</span>
              </span>
            </div>

            <div>
              <h1 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>
                {displayName}
              </h1>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>
                {me?.phone ? formatPhoneNumber(me.phone) : "Phone not available"}
              </div>
              
            </div>

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: "8px 12px",
                  background: colors.dangerBg,
                  color: colors.danger,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* Email Address (read-only) */}
            <label style={labelStyle}>{t("emailAddress") || "Email Address"}</label>
            <p style={readonlyStyle}>{me?.email_address || `${me?.phone || "user"}@${EMAIL_DOMAIN}`}</p>

            {/* Display Name Edit */}
            <label style={labelStyle}>{t("displayName") || "Display Name"}</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                placeholder={t("yourName") || "Your Name"}
                aria-label={t("displayName") || "Display Name"}
              />
              <button
                type="button"
                className="btn-primary btn-inline"
                aria-pressed={nameSaved}
                aria-label={nameSaved ? (t("saved") || "Saved") : (t("save") || "Save")}
                style={{
                  ...buttonStyle,
                  width: "auto",
                  height: 44,
                  minWidth: 96,
                  flex: "none",
                  background: nameSaved ? "var(--success)" : "var(--primary)",
                  color: "var(--on-primary)",
                  boxShadow: nameSaved ? "0 0 0 2px var(--success-bg)" : "var(--shadow-sm)",
                }}
                onClick={saveName}
              >
                {nameSaved ? (
                  <>
                    <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0 }} aria-hidden="true" />
                    <span>{t("saved") || "Saved"}</span>
                  </>
                ) : (
                  <span>{t("save") || "Save"}</span>
                )}
              </button>
            </div>

            {/* Alias IDs */}
            <label style={labelStyle}>{t("aliasIds") || "Alias IDs"}</label>
            {aliases.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {aliases.map((a) => (
                  <span
                    key={a}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px 4px 10px",
                      borderRadius: 6,
                      background: colors.surfaceAlt,
                      fontSize: 12,
                      fontWeight: 500,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <span>{a}@{EMAIL_DOMAIN}</span>
                    <button
                      type="button"
                      data-ui-exempt="true"
                      onClick={() => handleDeleteAlias(a)}
                      title={`Remove alias ${a}`}
                      aria-label={`Remove alias ${a}`}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: colors.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        padding: 2,
                        borderRadius: 3,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = colors.danger)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = colors.textSecondary)}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: "2px 0 8px" }}>
                No aliases created yet.
              </p>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                style={inputStyle}
                placeholder={t("newAlias") || "new-alias"}
                aria-label={t("newAlias") || "new-alias"}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAlias(); }}
              />
              <button
                type="button"
                className="btn-secondary btn-inline"
                aria-label={t("add") || "Add"}
                style={{
                  ...buttonStyle,
                  width: "auto",
                  height: 44,
                  minWidth: 96,
                  flex: "none",
                  background: "var(--raised)",
                  color: "var(--text)",
                  border: "1px solid var(--border-strong)",
                }}
                onClick={submitAlias}
              >
                <Plus size={16} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>{t("add") || "Add"}</span>
              </button>
            </div>

            {/* ── Language Preference ────────────────────────────────────────── */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>{t("language") || "Language"}</label>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Globe size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                    {t("appLanguage") || "App Language"}
                  </span>
                </div>
                <ThemedSelect
                  value={lang}
                  onChange={(newLang) => {
                    const code = typeof newLang === "object" ? (newLang.target?.value ?? newLang.value) : newLang;
                    if (code) setLang(code);
                  }}
                  options={supportedLanguages.map((l) => ({ value: l.code, label: l.label }))}
                  triggerStyle={{
                    border: "1px solid var(--border-strong)",
                    borderRadius: 8,
                    padding: "7px 14px",
                    background: colors.surface,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            {/* ── Appearance / Theme Control (Light / Dark / Auto) ───────────── */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>{t("appearance") || "Appearance"}</label>
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 10px" }}>
                Choose your preferred interface theme.
              </p>
              <div
                role="group"
                aria-label="Theme selection"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                }}
              >
                {[
                  { key: "light", label: "Light", Icon: Sun },
                  { key: "dark", label: "Dark", Icon: Moon },
                  { key: "auto", label: "Auto", Icon: Monitor },
                ].map((opt) => {
                  const active = (themeMode || (isDark ? "dark" : "light")) === opt.key;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setThemeMode && setThemeMode(opt.key)}
                      style={{
                        minHeight: 48,
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderRadius: "var(--r-md)",
                        border: active ? `2px solid ${colors.accent}` : `1.5px solid ${colors.borderStrong}`,
                        background: active ? colors.accentLight : colors.surfaceAlt,
                        color: active ? colors.accent : colors.textPrimary,
                        fontWeight: active ? 700 : 500,
                        fontSize: 14,
                        fontFamily: "var(--font-sans)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                      }}
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                {themeMode === "dark"
                  ? "Dark mode active."
                  : themeMode === "auto"
                  ? "Following device system preference automatically."
                  : "Light mode active."}
              </div>
            </div>

            {/* ── Chat Background (Wallpaper Picker) ──────────────────────────── */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
              <WallpaperPickerSection colors={colors} />
            </div>


            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-text"
          onClick={() => { setShowCp((v) => !v); setCpErr(""); setCpMsg(""); }}
          style={{
            width: "100%",
            minHeight: 44,
            justifyContent: "center",
            border: "1px solid var(--border-strong)",
            background: "var(--raised)",
            color: "var(--text)",
            fontWeight: 600,
            fontSize: 14,
            borderRadius: "var(--r-lg)",
            height: 44,
          }}
              >
                <KeyRound size={16} strokeWidth={2} color={colors.accent} />
                <span>{t("changePassword") || "Change password"}</span>
              </button>
              {showCp && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{t("cpTitle")}</div>
                  <input type="password" autoComplete="current-password" placeholder={t("cpCurrent")} aria-label={t("cpCurrent")} value={cpCur} onChange={(e) => setCpCur(e.target.value)} style={{ minHeight: 40, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border-strong)", background: "var(--raised)", color: "var(--text)", fontSize: 14 }} />
                  <input type="password" autoComplete="new-password" placeholder={t("cpNew")} aria-label={t("cpNew")} value={cpNew} onChange={(e) => setCpNew(e.target.value)} style={{ minHeight: 40, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border-strong)", background: "var(--raised)", color: "var(--text)", fontSize: 14 }} />
                  <input type="password" autoComplete="new-password" placeholder={t("cpConfirm")} aria-label={t("cpConfirm")} value={cpConf} onChange={(e) => setCpConf(e.target.value)} style={{ minHeight: 40, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border-strong)", background: "var(--raised)", color: "var(--text)", fontSize: 14 }} />
                  {cpErr && <div style={{ fontSize: 12, color: "var(--danger)" }}>{cpErr}</div>}
                  {cpMsg && <div style={{ fontSize: 12, color: colors.success }}>{cpMsg}</div>}
                  <button type="button" className="btn-primary" disabled={cpBusy || !cpCur || !cpNew || !cpConf} onClick={submitChangePw} style={{ minHeight: 40, borderRadius: "var(--r-md)", fontWeight: 600, fontSize: 14, cursor: cpBusy ? "wait" : "pointer", opacity: (cpBusy || !cpCur || !cpNew || !cpConf) ? 0.5 : 1 }}>
                    {t("cpTitle")}
                  </button>
                </div>
              )}

              <button
                type="button"
                className="btn-text"
          onClick={handleLogout}
          style={{
            width: "100%",
            minHeight: 44,
            justifyContent: "center",
            border: "1px solid var(--danger)",
            background: "transparent",
            color: "var(--danger)",
            fontWeight: 600,
            fontSize: 14,
            borderRadius: "var(--r-lg)",
            height: 44,
            outline: "1px solid var(--danger)",
            outlineOffset: "-1px",
          }}
              >
                <LogOut size={16} strokeWidth={2} />
                <span>{t("logOut") || "Log Out"}</span>
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
