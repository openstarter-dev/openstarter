// apps/desktop/src/main/shortcuts.ts —— 全局快捷键
// 注册系统级快捷键，通过 IPC 事件通知渲染进程

import { globalShortcut, BrowserWindow } from "electron";
import { logInfo, logWarn } from "./log";

const SHORTCUTS = [
  {
    accelerator: "CommandOrControl+K",
    action: "search",
    description: "Open search",
  },
] as const;

export function registerShortcuts(window: BrowserWindow): void {
  try {
    for (const shortcut of SHORTCUTS) {
      const registered = globalShortcut.register(shortcut.accelerator, () => {
        window.webContents.send("shortcut-triggered", shortcut.action);
      });
      if (registered) {
        logInfo(`shortcut registered: ${shortcut.accelerator} -> ${shortcut.action}`);
      } else {
        logWarn(`failed to register shortcut: ${shortcut.accelerator}`);
      }
    }
  } catch {
    // 测试环境或 Electron 不可用时安全忽略
  }
}

export function unregisterShortcuts(): void {
  try {
    globalShortcut.unregisterAll();
    logInfo("all shortcuts unregistered");
  } catch {
    // 测试环境或 Electron 不可用时安全忽略
  }
}
