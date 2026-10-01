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
import { getMe, updateMe, updateMyAvatar, uploadAttachment, addAlias, deleteAlias, clearToken } from "../api/client.js";
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
    setSelected(fileOrNull);
    try {
      if (fileOrNull) localStorage.setItem("chatWallpaper", fileOrNull);
      else localStorage.removeItem("chatWallpaper");
    } catch {}
    // Notify ChatView in same tab immediately (storage event only fires cross-tab)
    try {
      window.dispatchEvent(new CustomEvent("chatWallpaperChange", { detail: fileOrNull }));
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

  return (
    <>
      <label style={labelStyle}>
        <ImageIcon size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />
        Chat Background
      </label>
      <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 10px" }}>
        Choose a wallpaper for the chat message area.
      </p>
      <div className="wallpaper-picker-grid" role="group" aria-label="Chat wallpaper options">
        {/* None (plain ivory) option */}
        <button
          type="button"
          className="wallpaper-picker-item wallpaper-picker-none"
          aria-pressed={!selected}
          onClick={() => pick(null)}
          title="No wallpaper"
          style={{ minHeight: 60 }}
        >
          {!selected && (
            <span className="wallpaper-picker-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
          )}
          <span className="wallpaper-picker-label">None</span>
        </button>

        {/* Manifest-driven entries (only enabled ones with a file) */}
        {manifest.filter((w) => w.file && w.enabled !== false).map((w) => (
          <button
            key={w.id}
            type="button"
            className="wallpaper-picker-item"
            aria-pressed={selected === w.file}
            onClick={() => pick(w.file)}
            title={w.label}
            style={{ minHeight: 60 }}
          >
            <img
              src={w.thumb || w.file}
              alt={w.alt || w.label}
              loading="lazy"
              decoding="async"
              onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
            />
            {selected === w.file && (
              <span className="wallpaper-picker-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
            )}
            <span className="wallpaper-picker-label">{w.label}</span>
          </button>
        ))}
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
                  onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
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
              {avatarSrc && (
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={handleAvatarRemove}
                  disabled={avatarBusy}
                  style={{
                    marginTop: 8,
                    marginLeft: -8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                    background: "none",
                    color: colors.textSecondary,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 8px",
                  }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                  <span>Remove photo</span>
                </button>
              )}
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
          onClick={() => navigate("/forgot-password")}
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
