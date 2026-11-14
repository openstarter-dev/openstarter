import { ipcMain, app, dialog, BrowserWindow } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logInfo } from "./log";

export interface AppSettings {
  launchOnStart: boolean;
  minimizeToTray: boolean;
  autoStart: boolean;
  theme: "light" | "dark" | "system";
  shortcuts: Record<string, string>;
}

const DEFAULT_SETTINGS: AppSettings = {
  launchOnStart: true,
  minimizeToTray: true,
  autoStart: false,
  theme: "system",
  shortcuts: {},
};

export function getSettingsPath(userDataPath: string): string {
  return join(userDataPath, "settings.json");
}

export function readSettings(userDataPath: string): AppSettings {
  try {
    const filePath = getSettingsPath(userDataPath);
    if (!existsSync(filePath)) {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = readFileSync(filePath, "utf8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Partial<AppSettings>, userDataPath: string): AppSettings {
  const current = readSettings(userDataPath);
  const merged = { ...current, ...settings };
  const filePath = getSettingsPath(userDataPath);
  writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return merged;
}

export function registerIpcHandlers(userDataPath: string): void {
  ipcMain.handle("desktop:get-version", () => app.getVersion());

  ipcMain.handle("desktop:get-settings", () => {
    return readSettings(userDataPath);
  });

  ipcMain.handle("desktop:set-settings", (_event, settings: Partial<AppSettings>) => {
    return writeSettings(settings, userDataPath);
  });

  ipcMain.handle("desktop:show-window", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.show();
      win.focus();
    }
  });

  ipcMain.handle("desktop:minimize-to-tray", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.hide();
    }
  });

  ipcMain.handle(
    "desktop:open-file",
    async (
      _event,
      options?: {
        filters?: { name: string; extensions: string[] }[];
      },
    ) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: options?.filters,
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  ipcMain.handle(
    "desktop:save-file",
    async (_event, data: string, options?: { defaultName?: string }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return null;
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options?.defaultName,
      });
      if (result.canceled || !result.filePath) return null;
      writeFileSync(result.filePath, data, "utf8");
      return result.filePath;
    },
  );

  // Arbitrary read-file/write-file IPC removed for security; keep user-confirmed dialog flows only
  // 出于安全移除任意路径读写 IPC，仅保留需用户确认的系统文件对话框能力
  logInfo("IPC handlers registered");
}

export function cleanupIpcHandlers(): void {
  const channels = [
    "desktop:get-version",
    "desktop:get-settings",
    "desktop:set-settings",
    "desktop:show-window",
    "desktop:minimize-to-tray",
    "desktop:open-file",
    "desktop:save-file",
  ];
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
  logInfo("IPC handlers cleaned up");
}
