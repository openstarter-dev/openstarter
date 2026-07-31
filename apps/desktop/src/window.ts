// apps/desktop/src/window.ts —— 创建主窗口、加载站点或兜底页、安全策略挂载。
//
// 这是唯一持有 BrowserWindow 生命周期的模块。所有决策（白名单判定、URL 解析、窗口状态
// 校验）都来自纯逻辑模块，这里只做 Electron API 的搭接（见 spec §5）。
import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";

import type { ResolvedUrl } from "./config";
import { logInfo, logWarn } from "./log";
import {
  createPermissionRequestHandler,
  createWillNavigateHandler,
  createWindowOpenHandler,
} from "./security";
import type { WindowStateStore } from "./window-state";

const OFFLINE_PAGE_PATH = join(
  import.meta.dirname,
  "..",
  "resources",
  "offline.html"
);
const PRELOAD_PATH = join(import.meta.dirname, "preload.cjs");

function loadOfflinePage(
  win: BrowserWindow,
  reason?: "config" | "network"
): void {
  const query = reason ? `?reason=${reason}` : "";
  win.loadFile(OFFLINE_PAGE_PATH, { search: query });
}

export interface CreateWindowParams {
  resolvedUrl: ResolvedUrl;
  windowStateStore: WindowStateStore;
}

/** 创建主窗口：站点 URL 有效则加载站点并挂载安全策略，否则直接加载兜底页。 */
export function createMainWindow(params: CreateWindowParams): BrowserWindow {
  const { resolvedUrl, windowStateStore } = params;
  const initialState = windowStateStore.read();

  const win = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    height: initialState.height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
      sandbox: true,
    },
    width: initialState.width,
    x: initialState.x,
    y: initialState.y,
  });

  const persistState = () => {
    const bounds = win.getBounds();
    windowStateStore.write({
      height: bounds.height,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    });
  };
  win.on("close", persistState);

  const openExternal: (url: string) => void = (url) => {
    shell.openExternal(url).catch((error) => {
      logWarn("failed to open external URL", url, error);
    });
  };

  if (!resolvedUrl.ok) {
    logWarn("no valid app URL configured:", resolvedUrl.reason);
    loadOfflinePage(win, "config");
    return win;
  }

  const allowedOrigin = new URL(resolvedUrl.url).origin;
  win.webContents.setWindowOpenHandler(createWindowOpenHandler(openExternal));
  win.webContents.on(
    "will-navigate",
    createWillNavigateHandler(allowedOrigin, openExternal)
  );
  win.webContents.session.setPermissionRequestHandler(
    createPermissionRequestHandler()
  );
  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      logWarn(
        `failed to load ${resolvedUrl.url}:`,
        errorCode,
        errorDescription
      );
      loadOfflinePage(win, "network");
    }
  );

  logInfo("loading", resolvedUrl.url);
  win.loadURL(resolvedUrl.url);

  return win;
}

/** dev 模式专用：轮询等待本地 web dev server 就绪，避免过早 loadURL 打到还没起来的端口。 */
export async function waitForDevServer(
  url: string,
  attempts = 60,
  intervalMs = 500
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential polling against a single dev server is intentional.
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // dev server not up yet
    }
    await delay(intervalMs);
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 挂载全局 webContents 策略：任何新建的 webContents（不只是主窗口）都拒绝 webview 附加。
 * 落实 spec §9 "策略挂在 app.on('web-contents-created') 上而非只挂主窗口"。
 * 由 main.ts 在启动时显式调用一次，不作为模块顶层副作用——避免这个文件被以任何方式
 * import 时都无条件触碰 Electron 的 app 单例。
 */
export function applyGlobalWebContentsPolicy(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}
