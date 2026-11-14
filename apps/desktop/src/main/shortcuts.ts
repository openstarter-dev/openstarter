import { globalShortcut, BrowserWindow } from "electron";
import { logInfo, logWarn } from "./log";

const SHORTCUTS = [
  {
    accelerator: "CommandOrControl+K",
    action: "search",
    description: "Open search",
  },
] as const;

export type ShortcutWindowTarget = BrowserWindow | (() => BrowserWindow | null);

function resolveShortcutWindow(target: ShortcutWindowTarget): BrowserWindow | null {
  const win = typeof target === "function" ? target() : target;
  return win && !win.isDestroyed() ? win : null;
}

export function registerShortcuts(windowTarget: ShortcutWindowTarget): void {
  try {
    for (const shortcut of SHORTCUTS) {
      const registered = globalShortcut.register(shortcut.accelerator, () => {
        // Resolve the active window dynamically so window recreation keeps shortcuts working
        // 动态解析当前窗口实例，避免窗口重建后快捷键引用已销毁的旧窗口
        const win = resolveShortcutWindow(windowTarget);
        if (win) {
          win.webContents.send("shortcut-triggered", shortcut.action);
        }
      });
      if (registered) {
        logInfo(`shortcut registered: ${shortcut.accelerator} -> ${shortcut.action}`);
      } else {
        logWarn(`failed to register shortcut: ${shortcut.accelerator}`);
      }
    }
  } catch {
  }
}

export function unregisterShortcuts(): void {
  try {
    globalShortcut.unregisterAll();
    logInfo("all shortcuts unregistered");
  } catch {
  }
}
