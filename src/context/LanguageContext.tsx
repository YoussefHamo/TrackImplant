/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

type Lang = 'en' | 'ar';
type LangData = typeof en;
interface LanguageContextType {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number> | string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const translations: Record<Lang, LangData> = { en, ar };

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('trackimplant_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch { /* localStorage not available */ }
    return 'en';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem('trackimplant_lang', lang);
  }, [lang, dir]);

  const setLang = (l: Lang) => setLangState(l);

  const t = (key: string, vars?: Record<string, string | number> | string): string => {
    const defaultText = typeof vars === 'string' ? vars : undefined;
    const interpolateVars = typeof vars === 'string' ? undefined : vars;
    const val = getNestedValue(translations[lang], key);
    if (typeof val === 'string') return interpolate(val, interpolateVars);
    const fallback = getNestedValue(translations.en, key);
    if (typeof fallback === 'string') return interpolate(fallback, interpolateVars);
    return defaultText ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
