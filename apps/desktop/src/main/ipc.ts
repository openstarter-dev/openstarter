// apps/desktop/src/main/ipc.ts —— 所有 IPC 处理器注册
// 在 app.whenReady() 之后由 main.ts 调用 registerIpcHandlers()

import { ipcMain, app, dialog, BrowserWindow } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logError, logInfo } from "./log";

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

export function readSettings(
  userDataPath: string
): AppSettings {
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

export function writeSettings(
  settings: Partial<AppSettings>,
  userDataPath: string
): AppSettings {
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

  ipcMain.handle(
    "desktop:set-settings",
    (_event, settings: Partial<AppSettings>) => {
      return writeSettings(settings, userDataPath);
    }
  );

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
      }
    ) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: options?.filters,
      });
      return result.canceled ? null : result.filePaths[0];
    }
  );

  ipcMain.handle(
    "desktop:save-file",
    async (
      _event,
      data: string,
      options?: { defaultName?: string }
    ) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return null;
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options?.defaultName,
      });
      if (result.canceled || !result.filePath) return null;
      writeFileSync(result.filePath, data, "utf8");
      return result.filePath;
    }
  );

  ipcMain.handle("desktop:read-file", (_event, filePath: string) => {
    try {
      return readFileSync(filePath, "utf8");
    } catch (error) {
      logError("failed to read file", filePath, error);
      return null;
    }
  });

  ipcMain.handle(
    "desktop:write-file",
    (_event, filePath: string, data: string) => {
      try {
        writeFileSync(filePath, data, "utf8");
        return true;
      } catch (error) {
        logError("failed to write file", filePath, error);
        return false;
      }
    }
  );

  logInfo("IPC handlers registered");
}

export function cleanupIpcHandlers(): void {
  // 移除所有由本模块注册的 handler
  const channels = [
    "desktop:get-version",
    "desktop:get-settings",
    "desktop:set-settings",
    "desktop:show-window",
    "desktop:minimize-to-tray",
    "desktop:open-file",
    "desktop:save-file",
    "desktop:read-file",
    "desktop:write-file",
  ];
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
  logInfo("IPC handlers cleaned up");
}