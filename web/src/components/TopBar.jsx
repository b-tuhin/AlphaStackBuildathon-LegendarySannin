import React, { useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { getAvatarInitials, getAvatarColor } from "../utils/contact.js";
import AccountMenu from "./AccountMenu.jsx";

export default function TopBar({ query, onQueryChange, me, onToggleSidebar, onUpdatedMe }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const displayName = me?.display_name || me?.phone || "User";
  const initials = getAvatarInitials(displayName);
  const avatarBg = getAvatarColor(me?.phone || me?.email_address);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        height: 56,
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        gap: 12,
        position: "relative",
        zIndex: 1000,
        flexShrink: 0,
      }}
    >
      {/* Sidebar toggle & Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: 200, flexShrink: 0 }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="icon-btn"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: colors.textSecondary,
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Toggle folders menu"
            aria-label="Toggle folders menu"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
        )}
        <span
          style={{
            fontWeight: 800,
            fontSize: 17,
            color: colors.textPrimary,
            letterSpacing: "-0.3px",
            userSelect: "none",
          }}
        >
          {t("appName")}
        </span>
      </div>

      {/* Full-width Search Bar */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={16}
          strokeWidth={2}
          style={{
            position: "absolute",
            left: 12,
            color: colors.textSecondary,
            pointerEvents: "none",
          }}
        />
        <input
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 36px 9px 36px",
            borderRadius: 20,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.surfaceAlt,
            fontSize: 14,
            color: colors.textPrimary,
            outline: "none",
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={(e) => {
            e.target.style.borderColor = colors.accent;
            e.target.style.background = colors.surface;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = colors.borderStrong;
            e.target.style.background = colors.surfaceAlt;
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            style={{
              position: "absolute",
              right: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: colors.danger,
              display: "flex",
              alignItems: "center",
              padding: 2,
            }}
            aria-label="Clear search"
          >
            <X size={15} strokeWidth={2} color={colors.danger} />
          </button>
        )}
      </div>

      {/* Profile & Account Affordance */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAccountMenuOpen(!accountMenuOpen); }}
          title={`Signed in as ${displayName} (${me?.email_address}). Click for settings.`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: avatarBg,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            border: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            userSelect: "none",
            transition: "box-shadow 0.15s ease, transform 0.12s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)"; }}
        >
          {initials}
        </button>
      </div>

      {/* Account Settings Menu */}
      <AccountMenu
        me={me}
        isOpen={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
        onUpdated={onUpdatedMe}
      />
    </header>
  );
}
