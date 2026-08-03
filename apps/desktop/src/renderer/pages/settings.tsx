import { useEffect, useState } from "react";
import type { AppSettings } from "../types";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    window.electronAPI?.getSettings().then(setSettings);
  }, []);

  if (!settings) return <div>Loading...</div>;

  const updateSetting = (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    window.electronAPI?.setSettings(updated);
  };

  return (
    <div>
      <h1 style={{ marginBottom: "24px" }}>Settings</h1>
      <div style={{ maxWidth: "480px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => updateSetting({ minimizeToTray: e.target.checked })}
          />
          Minimize to tray on close
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={settings.autoStart}
            onChange={(e) => updateSetting({ autoStart: e.target.checked })}
          />
          Launch at startup
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <span style={{ minWidth: "80px" }}>Theme:</span>
          <select
            value={settings.theme}
            onChange={(e) =>
              updateSetting({
                theme: e.target.value as AppSettings["theme"],
              })
            }
            style={{
              padding: "6px 12px",
              background: "#1a1a1a",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: "4px",
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
    </div>
  );
}