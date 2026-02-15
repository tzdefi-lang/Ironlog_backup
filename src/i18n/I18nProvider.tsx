import React, { createContext, useCallback, useMemo, useState } from 'react';
import en from '@/i18n/en.json';
import zh from '@/i18n/zh.json';

export type Locale = 'en' | 'zh';

type Dictionary = Record<string, unknown>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const dictionaries: Record<Locale, Dictionary> = { en, zh };
const LOCALE_STORAGE_KEY = 'ironlog_locale';

const normalizeLocale = (value: string | null | undefined): Locale => {
  if (!value) return 'en';
  return value.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

const resolveInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved) return normalizeLocale(saved);
  return normalizeLocale(window.navigator.language);
};

const getByPath = (dictionary: Dictionary, key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>((acc, segment) => {
      if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[segment];
      }
      return undefined;
    }, dictionary);

  return typeof value === 'string' ? value : undefined;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return getByPath(dictionaries[locale], key) ?? getByPath(dictionaries.en, key) ?? key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
