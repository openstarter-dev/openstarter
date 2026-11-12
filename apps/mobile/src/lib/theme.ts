import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";

import type { ThemePreference } from "./preferences";
import { loadThemePreference, saveThemePreference } from "./preferences";

export function useThemePreference() {
  const { setColorScheme } = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>(() => loadThemePreference());

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setStoredPreference(next);
  }, []);

  return { preference, setPreference };
}
