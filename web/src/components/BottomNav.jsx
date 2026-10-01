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
    height: 44,
    borderRadius: 999,
    background: "transparent",
    border: "none",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    color: "var(--muted)",
    padding: "0 12px",
    transition: "background-color 0.15s ease, color 0.15s ease",
  };
  const tabBtnActive = {
    background: "var(--primary-tint)",
    color: "var(--link)",
    fontWeight: 600,
  };

  return (
    <nav
      style={{
        margin: "0 12px calc(8px + env(safe-area-inset-bottom, 0px))",
        height: 64,
        borderRadius: "var(--r-xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: "none",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "0 8px",
        zIndex: 800,
        flexShrink: 0,
      }}
      aria-label="Folder Navigation"
    >
      {/* 1. Home / Inbox & Sent */}
      <button
        type="button"
        style={{ ...tabBtnBase, ...(isHomeActive ? tabBtnActive : {}) }}
        onClick={() => { setShowMore(false); onSelect("home"); }}
        title="Inbox & Sent"
      >
        <Inbox size={18} color={isHomeActive ? "var(--link)" : "var(--muted)"} />
        <span style={{ fontSize: 13, lineHeight: 1 }}>Inbox</span>
      </button>

      {/* 2. More (Spam / Trash) */}
      <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }} ref={moreRef}>
        {showMore && (
          <div
            style={{
              position: "absolute",
              bottom: 58,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-sm)",
              padding: "4px 0",
              minWidth: 140,
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                fontSize: 13,
                color: folder === "spam" && !isProfileActive ? "var(--link)" : "var(--text)",
                background: folder === "spam" && !isProfileActive ? "var(--primary-tint)" : "transparent",
                cursor: "pointer",
                userSelect: "none",
                fontWeight: folder === "spam" && !isProfileActive ? 600 : 400,
              }}
              onClick={() => { onSelect("spam");  setShowMore(false); }}
            >
              <ShieldAlert size={16} />
              <span>Spam</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                fontSize: 13,
                color: folder === "trash" && !isProfileActive ? "var(--link)" : "var(--text)",
                background: folder === "trash" && !isProfileActive ? "var(--primary-tint)" : "transparent",
                cursor: "pointer",
                userSelect: "none",
                fontWeight: folder === "trash" && !isProfileActive ? 600 : 400,
              }}
              onClick={() => { onSelect("trash"); setShowMore(false); }}
            >
              <Trash2 size={16} />
              <span>Trash</span>
            </div>
          </div>
        )}
        <button
          type="button"
          style={{ ...tabBtnBase, width: "100%", ...(isMoreActive ? tabBtnActive : {}) }}
          onClick={() => setShowMore((prev) => !prev)}
          title="More folders (Spam & Trash)"
        >
          {React.cloneElement(renderMoreIcon(), { color: isMoreActive ? "var(--link)" : "var(--muted)" })}
          <span style={{ fontSize: 13, lineHeight: 1 }}>{getMoreLabel()}</span>
        </button>
      </div>

      {/* 3. Profile */}
      <button
        type="button"
        style={{ ...tabBtnBase, ...(isProfileActive ? tabBtnActive : {}) }}
        onClick={() => { setShowMore(false); onOpenProfile(); }}
        title="Profile & Settings"
      >
        <User size={18} color={isProfileActive ? "var(--link)" : "var(--muted)"} />
        <span style={{ fontSize: 13, lineHeight: 1 }}>Profile</span>
      </button>
    </nav>
  );
}
