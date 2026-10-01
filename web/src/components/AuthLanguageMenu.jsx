import React, { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function AuthLanguageMenu() {
  const { t, lang, setLang, supportedLanguages } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const current = supportedLanguages.find((l) => l.code === lang) || supportedLanguages[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code) => {
    setLang(code);
    setOpen(false);
    if (btnRef.current) btnRef.current.focus();
  };

  return (
    <div className="auth-lang" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className="auth-lang-btn"
        aria-label={t("languageLabel")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe size={18} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>{current.label}</span>
      </button>
      {open && (
        <div className="auth-lang-pop" role="listbox" aria-label={t("languageLabel")}>
          {supportedLanguages.map((l) => {
            const selected = l.code === lang;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={selected}
                className="auth-lang-item"
                onClick={() => choose(l.code)}
              >
                <span>{l.label}</span>
                {selected && <Check size={18} strokeWidth={2.5} aria-hidden="true" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
