// apps/mobile/src/lib/theme.ts —— 主题偏好（浅色/深色/跟随系统）。
// 不复用 next-themes：那是 Web 专属的。NativeWind 的 setColorScheme 接受
// "light" | "dark" | "system"，与我们持久化的三个值一一对应。
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";

import type { ThemePreference } from "./preferences";
import { loadThemePreference, saveThemePreference } from "./preferences";

export function useThemePreference() {
  const { setColorScheme } = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setStoredPreference(next);
  }, []);

  return { preference, setPreference };
}
