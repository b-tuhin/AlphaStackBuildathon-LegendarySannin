import React, { useState, useEffect } from "react";

export default function EmptyState({ Icon, title, body }) {
  const readChoice = () => { try { return localStorage.getItem("chatWallpaper") === "none" ? "none" : "doodle"; } catch { return "doodle"; } };
  const readTheme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [choice, setChoice] = useState(readChoice);
  const [theme, setTheme] = useState(readTheme);
  const [files, setFiles] = useState(null);
  useEffect(() => {
    const onChange = (e) => setChoice(e.detail === "none" ? "none" : "doodle");
    const onStorage = (e) => { if (e.key === "chatWallpaper") setChoice(e.newValue === "none" ? "none" : "doodle"); };
    window.addEventListener("chatWallpaperChange", onChange);
    window.addEventListener("storage", onStorage);
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    fetch("/assets/wallpapers/manifest.json").then((r) => r.json()).then((d) => {
      const e = Array.isArray(d) ? d.find((x) => x.id === "doodle") : null;
      if (e) setFiles(e);
    }).catch(() => {});
    return () => { window.removeEventListener("chatWallpaperChange", onChange); window.removeEventListener("storage", onStorage); obs.disconnect(); };
  }, []);
  const wpUrl = choice === "none" || !files ? null : (theme === "dark" ? (files.fileDark || files.file) : files.file);
  const wpStyle = wpUrl ? { backgroundImage: `url("${wpUrl}")`, backgroundSize: `${Math.round(2560 / (window.devicePixelRatio || 1))}px ${Math.round(1440 / (window.devicePixelRatio || 1))}px`, backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {};
  return (
    <div
      style={{
        ...wpStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        flex: 1,
        width: "100%",
        minWidth: 0,
        padding: 32,
        gap: 12,
        boxSizing: "border-box",
      }}
    >
      {Icon && (
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "var(--primary-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={40} strokeWidth={1.5} color="var(--link)" />
        </div>
      )}
      {title && (
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
      )}
      {body && (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--muted)",
            maxWidth: 320,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        >
          {body}
        </p>
      )}
    </div>
  );
}
