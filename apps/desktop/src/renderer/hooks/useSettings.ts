// apps/desktop/src/renderer/hooks/useSettings.ts
// 设置管理 hook

import { useState, useEffect, useCallback } from "react";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  launchOnStart: true,
  minimizeToTray: true,
  autoStart: false,
  theme: "system",
  shortcuts: {},
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    window.electronAPI?.setSettings(partial).then(setSettings);
  }, []);

  return { settings, updateSettings, loading };
}
