import { getItem, setItem } from "expo-secure-store";

import { isSupportedLocale } from "./locale";

const THEME_KEY = "openstarter_theme";
const LOCALE_KEY = "openstarter_locale";

export type ThemePreference = "light" | "dark" | "system";

const THEME_VALUES: readonly ThemePreference[] = ["light", "dark", "system"];

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && (THEME_VALUES as readonly string[]).includes(value);
}

export function loadThemePreference(): ThemePreference {
  const stored = getItem(THEME_KEY);
  return isThemePreference(stored) ? stored : "system";
}

export function saveThemePreference(value: ThemePreference): void {
  setItem(THEME_KEY, value);
}

export function loadLocalePreference(): string | null {
  const stored = getItem(LOCALE_KEY);
  return isSupportedLocale(stored) ? stored : null;
}

export function saveLocalePreference(value: string): void {
  setItem(LOCALE_KEY, value);
}
