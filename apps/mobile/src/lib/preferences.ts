// apps/mobile/src/lib/preferences.ts —— 主题与语言选择的持久化。
//
// 复用 expo-secure-store 而不是引入 AsyncStorage：这两个标量本身不是机密，
// 但 SecureStore 已经是依赖（会话存储需要它），为两个标量再加一个存储库不值得；
// 且它的 getItem 是同步的，启动时能在首帧之前读到，避免闪一下错误的主题/语言。
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
