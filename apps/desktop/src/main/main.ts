// apps/desktop/src/main.ts —— 主进程生命周期编排。
//
// dev 模式：等待本地 web dev server 就绪后加载 http://localhost:3000。
// prod 模式：加载构建时注入的站点 URL（可被运行时环境变量覆盖），失败时降级到兜底页。
// 具体决策全部来自纯逻辑模块（config/security/window-state/menu），这里只做编排。
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu } from "electron";

import { getDesktopMode, resolveAppUrl } from "./config";
import { logError, logInfo, logWarn } from "./log";
import { buildMenuTemplate } from "./menu";
import { maybeCheckForUpdates } from "./updater";
import {
  applyGlobalWebContentsPolicy,
  createMainWindow,
  waitForDevServer,
} from "./window";
import { createFileWindowStateStore } from "./window-state";

// esbuild 在构建时通过 define 注入的全局常量，见 scripts/build.mjs。
declare const __OPENSTARTER_API_URL__: string;

const UPDATE_CHECK_DELAY_MS = 10_000;

async function main(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  const { isPackaged } = app;
  const mode = getDesktopMode(isPackaged);

  applyGlobalWebContentsPolicy();

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(buildMenuTemplate(process.platform === "darwin"))
  );

  await app.whenReady();

  if (mode === "dev") {
    const devUrl = process.env.OPENSTARTER_API_URL ?? "http://localhost:3000";
    logInfo("waiting for dev server at", devUrl);
    const ready = await waitForDevServer(devUrl);
    if (!ready) {
      logWarn(`dev server ${devUrl} did not respond in time; loading anyway.`);
    }
  }

  const resolvedUrl = resolveAppUrl({
    buildTimeUrl: __OPENSTARTER_API_URL__,
    env: process.env,
    isPackaged,
  });

  const windowStateStore = createFileWindowStateStore(
    join(app.getPath("userData"), "window-state.json")
  );

  let currentWindow = createMainWindow({ resolvedUrl, windowStateStore });

  ipcMain.handle("desktop:retry", () => {
    currentWindow.close();
    currentWindow = createMainWindow({ resolvedUrl, windowStateStore });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      currentWindow = createMainWindow({ resolvedUrl, windowStateStore });
    }
  });

  // 是否检查、检查什么条件，全部由 maybeCheckForUpdates 内部判断（含 isUpdaterDisabled）；
  // 这里只负责延迟调度，不重复判断一次开关，避免两处逻辑分叉。
  setTimeout(() => {
    maybeCheckForUpdates(isPackaged).catch((error: unknown) => {
      logError("update check failed", error);
    });
  }, UPDATE_CHECK_DELAY_MS);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

main().catch((error: unknown) => {
  logError("fatal error during startup", error);
  app.quit();
});
