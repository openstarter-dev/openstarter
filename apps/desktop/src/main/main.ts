// apps/desktop/src/main/main.ts —— 主进程生命周期编排。
//
// dev 模式：加载 Vite dev server（http://localhost:5173，由 run-desktop.mjs 启动）。
// prod 模式：加载本地构建产物（dist/renderer/index.html）。
// 具体决策全部来自纯逻辑模块（config/security/window-state/menu），这里只做编排。
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu } from "electron";

import { getDesktopMode } from "./config";
import { registerIpcHandlers } from "./ipc";
import { logError, logInfo, logWarn } from "./log";
import { buildMenuTemplate } from "./menu";
import { createTray, destroyTray } from "./tray";
import { registerShortcuts, unregisterShortcuts } from "./shortcuts";
import { maybeCheckForUpdates } from "./updater";
import {
  applyGlobalWebContentsPolicy,
  createMainWindow,
  waitForDevServer,
} from "./window";
import { createFileWindowStateStore } from "./window-state";
import { createTokenStore } from "./token-store";
import { createApiProxy } from "./api-proxy";
import { createAuthService } from "./auth-service";
import { openOAuthWindow } from "./oauth-window";

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

  // 注册 IPC 处理器
  registerIpcHandlers(app.getPath("userData"));

  // 初始化认证服务
  const API_BASE_URL = process.env.OPENSTARTER_API_URL || "http://localhost:3000";
  const tokenStore = createTokenStore(join(app.getPath("userData"), "auth-token.enc"));
  const apiProxy = createApiProxy({
    baseUrl: API_BASE_URL,
    getToken: () => tokenStore.get(),
  });
  const authService = createAuthService({
    baseUrl: API_BASE_URL,
    tokenStore,
    apiRequest: apiProxy,
  });

  // 注册认证 IPC 处理器
  ipcMain.handle("auth:sign-in-email", async (_event, { email, password }) => {
    try {
      const result = await authService.signInWithEmail(email, password);
      return { code: 200, message: "ok", data: result };
    } catch (error) {
      return { code: 401, message: (error as Error).message };
    }
  });

  ipcMain.handle("auth:sign-in-oauth", async (_event, { provider }) => {
    try {
      const result = await openOAuthWindow(provider as "google" | "github", {
        baseUrl: API_BASE_URL,
        getSession: () => authService.getSession(),
        tokenStore,
      });
      return { code: 200, message: "ok", data: result };
    } catch (error) {
      return { code: 401, message: (error as Error).message };
    }
  });

  ipcMain.handle("auth:sign-out", async () => {
    try {
      await authService.signOut();
      return { code: 200, message: "ok" };
    } catch (error) {
      return { code: -1, message: (error as Error).message };
    }
  });

  ipcMain.handle("auth:get-session", async () => {
    try {
      const result = await authService.getSession();
      return { code: 200, message: "ok", data: result };
    } catch {
      return { code: 401, message: "no_session" };
    }
  });

  ipcMain.handle("api:request", async (_event, request) => {
    return apiProxy(request);
  });

  // 构建加载 URL：dev 模式指向 Vite dev server，prod 模式指向本地文件
  const resolvedUrl: { ok: true; url: string } =
    mode === "dev"
      ? { ok: true, url: "http://localhost:5173" }
      : {
          ok: true,
          url: `file://${join(__dirname, "..", "renderer", "index.html")}`,
        };

  // dev 模式等待 Vite dev server 就绪
  if (mode === "dev") {
    logInfo("waiting for renderer dev server at", resolvedUrl.url);
    const ready = await waitForDevServer(resolvedUrl.url);
    if (!ready) {
      logWarn(
        `renderer dev server ${resolvedUrl.url} did not respond in time; loading anyway.`
      );
    }
  }

  const windowStateStore = createFileWindowStateStore(
    join(app.getPath("userData"), "window-state.json")
  );

  let currentWindow = createMainWindow({ resolvedUrl, windowStateStore });

  // 创建系统托盘
  createTray(currentWindow);

  // 注册全局快捷键
  registerShortcuts(currentWindow);

  // 退出时清理
  app.on("before-quit", () => {
    destroyTray();
    unregisterShortcuts();
  });

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