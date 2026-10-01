import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { getAsset } from "../config/assets.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useIsMobile } from "../utils/useIsMobile.js";

function safeAsset(id) {
  try { return getAsset(id); } catch { return null; }
}

export default function NotFound() {
  const { t } = useI18n();
  const isMobile = useIsMobile(768);
  const readDark = () => document.documentElement.getAttribute("data-theme") === "dark";
  const [isDark, setIsDark] = useState(readDark);
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(readDark()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const asset = safeAsset(isMobile ? "error-mobile" : "error-desktop");
  const showImage = Boolean(asset && asset.url) && failedUrl !== asset.url;

  let slot = { width: "100%", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" };
  if (showImage && !isMobile) {
    slot = { ...slot, width: "50%", marginLeft: "auto" };
  } else if (showImage && isMobile) {
    slot = { ...slot, alignItems: "flex-end", padding: "12px 12px calc(12px + env(safe-area-inset-bottom, 0px))" };
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {showImage && (
        <img
          src={asset.url}
          alt=""
          aria-hidden="true"
          onError={() => setFailedUrl(asset.url)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: asset.fit || "cover", objectPosition: asset.objectPosition || "center", display: "block" }}
        />
      )}
      {showImage && isDark && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim)" }} />
      )}
      <div style={{ position: "relative", ...slot }}>
        <main
          id="main-content"
          style={{
            width: "100%",
            maxWidth: 440,
            padding: 24,
            boxSizing: "border-box",
            textAlign: "center",
            background: "var(--surface, var(--raised))",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Logo size={96} />
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--link)", lineHeight: 1.2 }}>404</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{t("notFoundTitle")}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--muted)", overflowWrap: "anywhere" }}>{t("notFoundBody")}</p>
          <Link
            to="/"
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, width: "100%", marginTop: 4, padding: "12px 24px", boxSizing: "border-box", textDecoration: "none", borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600 }}
          >
            {t("notFoundButton")}
          </Link>
        </main>
      </div>
    </div>
  );
}