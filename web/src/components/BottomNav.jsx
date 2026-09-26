import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { Inbox, ShieldAlert, Trash2, User, MoreHorizontal } from "lucide-react";

export default function BottomNav({ folder, onSelect, onOpenProfile, isProfileActive }) {
  const { colors } = useTheme();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    }
    if (showMore) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showMore]);

  const isHomeActive  = !isProfileActive && folder === "home";
  const isMoreActive  = !isProfileActive && (folder === "spam" || folder === "trash" || showMore);

  const getMoreLabel = () => {
    if (!isProfileActive) {
      if (folder === "spam")  return "Spam";
      if (folder === "trash") return "Trash";
    }
    return "More";
  };

  const renderMoreIcon = () => {
    if (!isProfileActive) {
      if (folder === "spam")  return <ShieldAlert size={18} />;
      if (folder === "trash") return <Trash2 size={18} />;
    }
    return <MoreHorizontal size={18} />;
  };

  const tabBtnBase = {
    flex: 1,
    height: "100%",
    background: "none",
    border: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    cursor: "pointer",
    color: colors.textSecondary,
    padding: "4px 8px",
    borderRadius: 8,
    transition: "background-color 0.15s ease, color 0.15s ease",
  };
  const tabBtnActive = { color: colors.accent, fontWeight: 700 };

  return (
    <nav
      style={{ height: 56, background: colors.surface, borderTop: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px", zIndex: 800, flexShrink: 0 }}
      aria-label="Folder Navigation"
    >
      {/* 1. Home / Inbox & Sent */}
      <button type="button" style={{ ...tabBtnBase, ...(isHomeActive ? tabBtnActive : {}) }} onClick={() => { setShowMore(false); onSelect("home"); }} title="Inbox & Sent">
        <Inbox size={18} />
        <span style={{ fontSize: 11, lineHeight: 1 }}>Inbox</span>
      </button>

      {/* 2. More (Spam / Trash) */}
      <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }} ref={moreRef}>
        {showMore && (
          <div style={{ position: "absolute", bottom: 58, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", padding: "4px 0", minWidth: 120, zIndex: 1000, display: "flex", flexDirection: "column" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, color: folder === "spam" && !isProfileActive ? colors.accent : colors.textPrimary, background: folder === "spam" && !isProfileActive ? colors.accentLight : "transparent", cursor: "pointer", userSelect: "none", fontWeight: folder === "spam" && !isProfileActive ? 700 : 400 }}
              onClick={() => { onSelect("spam");  setShowMore(false); }}
            >
              <ShieldAlert size={16} />
              <span>Spam</span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, color: folder === "trash" && !isProfileActive ? colors.accent : colors.textPrimary, background: folder === "trash" && !isProfileActive ? colors.accentLight : "transparent", cursor: "pointer", userSelect: "none", fontWeight: folder === "trash" && !isProfileActive ? 700 : 400 }}
              onClick={() => { onSelect("trash"); setShowMore(false); }}
            >
              <Trash2 size={16} />
              <span>Trash</span>
            </div>
          </div>
        )}
        <button type="button" style={{ ...tabBtnBase, width: "100%", ...(isMoreActive ? tabBtnActive : {}) }} onClick={() => setShowMore((prev) => !prev)} title="More folders (Spam & Trash)">
          {renderMoreIcon()}
          <span style={{ fontSize: 11, lineHeight: 1 }}>{getMoreLabel()}</span>
        </button>
      </div>

      {/* 4. Profile */}
      <button type="button" style={{ ...tabBtnBase, ...(isProfileActive ? tabBtnActive : {}) }} onClick={() => { setShowMore(false); onOpenProfile(); }} title="Profile & Settings">
        <User size={18} />
        <span style={{ fontSize: 11, lineHeight: 1 }}>Profile</span>
      </button>
    </nav>
  );
}
