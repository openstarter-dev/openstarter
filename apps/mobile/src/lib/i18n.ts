import { i18next, initI18next, type SupportedLocale } from "@openstarter/i18n-mobile";
import { useCallback, useState } from "react";

import { getLocales } from "expo-localization";

import { resolveInitialLocale } from "./locale";
import { loadLocalePreference, saveLocalePreference } from "./preferences";

const initialLocale = resolveInitialLocale(
  getLocales().map((entry) => entry.languageTag),
  loadLocalePreference(),
);

initI18next({ initialLocale });

export function useAppLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setAppLocale = useCallback((next: SupportedLocale) => {
    saveLocalePreference(next);
    void i18next.changeLanguage(next);
    setLocaleState(next);
  }, []);

  return { locale, setAppLocale };
}
