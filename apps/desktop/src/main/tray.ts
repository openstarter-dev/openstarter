// apps/desktop/src/main/tray.ts —— 系统托盘
// 创建托盘图标和菜单，管理窗口显示/隐藏

import { app, Menu, Tray, BrowserWindow, nativeImage } from "electron";
import { join } from "node:path";
import { logInfo, logError } from "./log";

let tray: Tray | null = null;

export function createTray(window: BrowserWindow): Tray | null {
  try {
    const iconPath = join(app.getAppPath(), "build-resources", "tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => {
          window.show();
          window.focus();
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
      if (window.isVisible()) {
        window.hide();
      } else {
        window.show();
        window.focus();
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
