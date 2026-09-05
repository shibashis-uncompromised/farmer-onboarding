"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en } from "./en";
import { hi } from "./hi";
import type { TranslationKey } from "./en";

export type Language = "en" | "hi";
export type { TranslationKey };

const DICTS: Record<Language, Record<TranslationKey, string>> = { en, hi };
const STORAGE_KEY = "onboarding-language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translate a key, optionally interpolating `{name}` placeholders. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Starts "en" so server-rendered/static-exported markup and the first
  // client render always match (no hydration mismatch) — the saved
  // preference (if any) is applied a moment later, once localStorage is
  // available, same pattern used for other client-only state in this app.
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "hi") setLanguageState(saved);
    } catch {
      // localStorage can throw in some embedded/private-browsing contexts —
      // just stay on the default language rather than crash the app over it.
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  };

  const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
    interpolate(DICTS[language][key] ?? DICTS.en[key] ?? key, vars);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
