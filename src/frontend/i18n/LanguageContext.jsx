import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, legacyText, translations } from "./translations";

const LanguageContext = createContext(null);

function normalizeLanguage(value) {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

function getInitialLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function resolvePath(source, path) {
  return String(path)
    .split(".")
    .reduce((current, part) => (current && current[part] !== undefined ? current[part] : undefined), source);
}

function interpolate(value, params = {}) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ""));
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);
  const missingKeysRef = useRef([]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage));
  }, []);

  const t = useCallback((key, params) => {
    const resolved = resolvePath(translations[language], key);

    if (resolved !== undefined) {
      return interpolate(resolved, params);
    }

    const fallback = resolvePath(translations.sq, key);

    if (!missingKeysRef.current.includes(key)) {
      missingKeysRef.current = [...missingKeysRef.current, key];
    }

    if (fallback !== undefined) {
      return interpolate(fallback, params);
    }

    return `[missing:${key}]`;
  }, [language]);

  const tx = useCallback((text) => {
    if (text === null || text === undefined || text === "") {
      return text;
    }

    return legacyText[language]?.[text] || text;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      tx,
      missingKeys: missingKeysRef.current,
    }),
    [language, setLanguage, t, tx]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return value;
}
