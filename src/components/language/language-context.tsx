"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

const LANG_STORAGE_KEY = "analytics-lang";

function readStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "fr",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang: (l: Lang) => {
      setLangState(l);
      try { window.localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* stockage indisponible */ }
    },
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Bouton FR / EN unique, utilisé dans l'en-tête de l'app. */
export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line p-1" role="group" aria-label="Language">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${lang === l ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
