import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";
import Avatar from "./Avatar.jsx";
import Logo from "./Logo.jsx";

export default function TopBar({ query, onQueryChange, me, onToggleSidebar }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isNarrow = useIsMobile(1023);
  const [focused, setFocused] = useState(false);

  const displayName = me?.display_name || me?.phone || "User";
  const avatarKey = me?.phone || me?.email_address;

  const openProfile = () => navigate("/settings/profile");

  const profileButton = (size) => (
    <button
      type="button"
      onClick={openProfile}
      title={`Signed in as ${displayName}${me?.email_address ? ` (${me.email_address})` : ""}. View full profile.`}
      aria-label="Open profile"
      style={{
        padding: 2,
        border: "none",
        background: "none",
        borderRadius: "50%",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        minWidth: 44,
        minHeight: 44,
        flexShrink: 0,
      }}
    >
      <Avatar src={me?.avatar_url} name={displayName} colorKey={avatarKey} size={size} />
    </button>
  );

  const clearButton = query ? (
    <button
      type="button"
      onClick={() => onQueryChange("")}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--danger)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        minWidth: 32,
        minHeight: 32,
        flexShrink: 0,
      }}
      aria-label="Clear search"
    >
      <X size={16} strokeWidth={2} color="var(--danger)" aria-hidden="true" />
    </button>
  ) : null;

  const menuButton = onToggleSidebar ? (
    <button
      type="button"
      data-sidebar-toggle
      onClick={onToggleSidebar}
      className="icon-btn"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--muted)",
        padding: 0,
        width: 44,
        height: 44,
        minWidth: 44,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        flexShrink: 0,
      }}
      title="Toggle folders menu"
      aria-label="Toggle folders menu"
    >
      <Menu size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  ) : null;

  // ── Mobile / Tablet (<=1023px): floating row with menu button, 48px search pill, avatar ──
  if (isNarrow) {
    return (
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "0 0 8px",
          background: "transparent",
          borderBottom: "none",
          position: "relative",
          zIndex: 1000,
          flexShrink: 0,
        }}
      >
        {menuButton}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 48,
            boxSizing: "border-box",
            padding: "0 14px",
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            background: "var(--raised)",
            boxShadow: focused ? "0 0 0 2px var(--focus)" : "none",
            transition: "box-shadow 0.15s ease, background 0.15s ease",
          }}
        >
          <Search size={18} strokeWidth={2} color="var(--muted)" style={{ flexShrink: 0 }} />
          <input
            style={{
              flex: 1,
              minWidth: 0,
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
              color: "var(--text)",
              padding: "0 4px",
              textOverflow: "ellipsis",
            }}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={t("searchPlaceholder")}
          />
          {clearButton}
        </div>
        {profileButton(40)}
      </header>
    );
  }

  // ── Desktop ────────────────────────────────────────────────────────────────
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        height: 64,
        boxSizing: "border-box",
        background: "transparent",
        borderBottom: "none",
        gap: 16,
        position: "relative",
        zIndex: 1000,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Decorative header accent — placeholder for a clouds image if added to _originals */}
      <div
        className="topbar-clouds-decor"
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 240,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: 0.12,
          zIndex: 0,
        }}
      />
      {/* Sidebar toggle & Brand Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: 220, flexShrink: 0 }}>
        {menuButton}
        <Logo size={44} />
      </div>

      {/* Full-width Search Bar */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={20}
          strokeWidth={1.75}
          style={{ position: "absolute", left: 14, color: colors.textSecondary, pointerEvents: "none" }}
        />
        <input
          style={{
            width: "100%",
            height: 44,
            boxSizing: "border-box",
            padding: "0 40px 0 42px",
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            background: "var(--raised)",
            fontSize: 14,
            color: colors.textPrimary,
            outline: "none",
            boxShadow: focused ? "0 0 0 2px var(--focus)" : "none",
            transition: "box-shadow 0.15s ease, background 0.15s ease",
          }}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {query && <div style={{ position: "absolute", right: 8, display: "flex" }}>{clearButton}</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{profileButton(40)}</div>
    </header>
  );
}
