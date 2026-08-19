// apps/desktop/src/renderer/pages/settings.tsx —— 设置页

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";
import { Button } from "@openstarter/ui-web/components/button";
import { Checkbox } from "@openstarter/ui-web/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import type { AppSettings } from "../types";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    window.electronAPI?.getSettings().then(setSettings);
  }, []);

  if (!settings) return <div className="text-muted-foreground">Loading...</div>;

  const updateSetting = (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    window.electronAPI?.setSettings(updated);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Checkbox
              id="minimize-to-tray"
              checked={settings.minimizeToTray}
              onCheckedChange={(checked) => updateSetting({ minimizeToTray: !!checked })}
            />
            <label htmlFor="minimize-to-tray" className="text-sm">
              Minimize to tray on close
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="auto-start"
              checked={settings.autoStart}
              onCheckedChange={(checked) => updateSetting({ autoStart: !!checked })}
            />
            <label htmlFor="auto-start" className="text-sm">
              Launch at startup
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme:</span>
            <Select
              value={settings.theme}
              onValueChange={(value) =>
                updateSetting({
                  theme: value as AppSettings["theme"],
                })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => updateSetting({ ...settings })} type="button">
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
