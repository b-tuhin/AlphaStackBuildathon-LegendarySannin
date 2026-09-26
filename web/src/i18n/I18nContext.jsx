import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { STRINGS, SUPPORTED_LANGUAGES } from "./strings.js";

const LANG_STORAGE_KEY = "phonemail_lang";

/** Return the best-match language code from a display label or code string */
function normalizeLangInput(rawValue) {
  if (!rawValue) return "en";
  // Direct code match (e.g. "hi", "en")
  if (STRINGS[rawValue]) return rawValue;
  // Match by label (e.g. "हिन्दी")
  const found = SUPPORTED_LANGUAGES.find((l) => l.label === rawValue);
  if (found) return found.code;
  return "en";
}

const I18nContext = createContext({
  t: (key, ...args) => key,
  lang: "en",
  langLabel: "English",
  setLang: () => {},
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      return normalizeLangInput(stored) || "en";
    } catch {
      return "en";
    }
  });

  const setLang = useCallback((rawValue) => {
    const code = normalizeLangInput(rawValue);
    setLangState(code);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {}
  }, []);

  // Expose a simple translation function
  const t = useCallback(
    (key, ...args) => {
      const dict = STRINGS[lang] || STRINGS.en;
      const val = dict[key] ?? STRINGS.en[key];
      if (typeof val === "function") return val(...args);
      return val ?? key;
    },
    [lang]
  );

  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label ?? "English";

  return (
    <I18nContext.Provider value={{ t, lang, langLabel, setLang, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export default I18nContext;
