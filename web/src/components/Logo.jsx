import React, { useState, useEffect } from "react";
import { getAsset } from "../config/assets.js";
import { useI18n } from "../i18n/I18nContext.jsx";

function safeGetAsset(id, fallbackId) {
  try {
    return getAsset(id);
  } catch (_) {
    try {
      return getAsset(fallbackId);
    } catch (__) {
      // Both ids missing — return a neutral object (no image path literal here).
      return { url: "" };
    }
  }
}


export default function Logo({ size = 36, width, height, style, className }) {
  const { t } = useI18n();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const checkTheme = () => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    };
    checkTheme();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") {
          checkTheme();
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const asset = isDark
    ? safeGetAsset("logo-mark-dark", "logo-mark")
    : safeGetAsset("logo-mark", "logo-mark-dark");
  const w = width ?? size;
  const h = height ?? size;

  return (
    <img
      src={asset.url}
      width={w}
      height={h}
      alt={t("logoAlt") || "Bharat Chat"}
      className={className}
      style={{
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
