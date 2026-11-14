import { app, Menu, Tray, BrowserWindow, nativeImage } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logInfo, logError } from "./log";

let tray: Tray | null = null;

export type WindowTarget = BrowserWindow | (() => BrowserWindow | null);

function resolveWindow(target: WindowTarget): BrowserWindow | null {
  const win = typeof target === "function" ? target() : target;
  return win && !win.isDestroyed() ? win : null;
}

function resolveTrayIconPath(): string {
  const baseDir = join(app.getAppPath(), "build-resources");
  const trayIcon = join(baseDir, "tray-icon.png");
  // Fallback to icon.png when dedicated tray-icon.png is absent in the starter scaffold
  // 当启动脚手架未单独提供 tray-icon.png 时回退到 icon.png
  return existsSync(trayIcon) ? trayIcon : join(baseDir, "icon.png");
}

export function createTray(windowTarget: WindowTarget): Tray | null {
  try {
    const icon = nativeImage.createFromPath(resolveTrayIconPath());
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => {
          const win = resolveWindow(windowTarget);
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      {
        type: "separator",
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setToolTip("OpenStarter");
    tray.setContextMenu(contextMenu);

    tray.on("click", () => {
      const win = resolveWindow(windowTarget);
      if (!win) {
        return;
      }
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    });

    logInfo("system tray created");
    return tray;
  } catch (error) {
    logError("failed to create tray", error);
    return null;
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    logInfo("system tray destroyed");
  }
}
