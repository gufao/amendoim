import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCallback } from "react";
import { ptBR, type TranslationKey } from "./pt-BR";
import { en } from "./en";

export type Locale = "pt-BR" | "en";

const translations: Record<Locale, Record<TranslationKey, string>> = {
  "pt-BR": ptBR,
  en,
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: "pt-BR",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "amendoim-locale" }
  )
);

export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const dict = translations[locale];

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let str = dict[key] || ptBR[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [dict]
  );

  return t;
}

export type { TranslationKey };
