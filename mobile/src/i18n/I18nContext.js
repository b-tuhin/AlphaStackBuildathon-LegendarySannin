import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STRINGS, SUPPORTED_LANGUAGES } from "./strings";

export const LANG_STORAGE_KEY = "@phonemail_lang";

/** Return the normalized language code from a label or code */
function normalizeLangInput(rawValue) {
  if (!rawValue) return "en";
  if (STRINGS[rawValue]) return rawValue;
  const found = SUPPORTED_LANGUAGES.find((l) => l.label === rawValue || l.code === rawValue);
  if (found) return found.code;
  return "en";
}

export const I18nContext = createContext({
  t: (key, ...args) => key,
  lang: "en",
  langLabel: "English",
  setLang: () => {},
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          setLangState(normalizeLangInput(stored));
        }
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback(async (rawValue) => {
    const code = normalizeLangInput(rawValue);
    setLangState(code);
    try {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {}
  }, []);

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
