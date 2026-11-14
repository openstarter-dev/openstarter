import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu } from "electron";

import { getDesktopMode } from "./config";
import { registerIpcHandlers } from "./ipc";
import { logError, logInfo, logWarn } from "./log";
import { buildMenuTemplate } from "./menu";
import { createTray, destroyTray } from "./tray";
import { registerShortcuts, unregisterShortcuts } from "./shortcuts";
import { maybeCheckForUpdates } from "./updater";
import { applyGlobalWebContentsPolicy, createMainWindow, waitForDevServer } from "./window";
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
    Menu.buildFromTemplate(buildMenuTemplate(process.platform === "darwin", mode === "dev")),
  );

  await app.whenReady();

  registerIpcHandlers(app.getPath("userData"));

  const API_BASE_URL =
    process.env.OPENSTARTER_API_URL ||
    process.env.VITE_APP_URL ||
    "http://localhost:3000";
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

  const resolvedUrl: { ok: true; url: string } =
    mode === "dev"
      ? { ok: true, url: "http://localhost:5173" }
      : {
          ok: true,
          url: `file://${join(__dirname, "..", "renderer", "index.html")}`,
        };

  if (mode === "dev") {
    logInfo("waiting for renderer dev server at", resolvedUrl.url);
    const ready = await waitForDevServer(resolvedUrl.url);
    if (!ready) {
      logWarn(`renderer dev server ${resolvedUrl.url} did not respond in time; loading anyway.`);
    }
  }

  const windowStateStore = createFileWindowStateStore(
    join(app.getPath("userData"), "window-state.json"),
  );

  let currentWindow = createMainWindow({ resolvedUrl, windowStateStore });

  // Pass a getter so tray and global shortcuts always reach the active window after recreation
  // 传入窗口 getter，确保重建窗口后托盘与全局快捷键仍指向最新窗口
  createTray(() => currentWindow);

  registerShortcuts(() => currentWindow);

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
