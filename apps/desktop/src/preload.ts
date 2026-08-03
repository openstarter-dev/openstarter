// apps/desktop/src/preload.ts —— 主进程/渲染进程桥。
//
// 通过 contextBridge 暴露最小 API，不暴露任何 Node 原语。
// desktop 命名空间用于兜底页（resources/offline.html）的重试功能。
// electronAPI 命名空间用于渲染进程 React 应用的桌面端原生能力。
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  retry: () => ipcRenderer.invoke("desktop:retry"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  getVersion: () => ipcRenderer.invoke("desktop:get-version"),

  // 文件系统
  openFile: (
    options?: { filters?: { name: string; extensions: string[] }[] }
  ) => ipcRenderer.invoke("desktop:open-file", options),
  saveFile: (data: string, options?: { defaultName?: string }) =>
    ipcRenderer.invoke("desktop:save-file", data, options),
  readFile: (path: string) => ipcRenderer.invoke("desktop:read-file", path),
  writeFile: (path: string, data: string) =>
    ipcRenderer.invoke("desktop:write-file", path, data),

  // 设置
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  setSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke("desktop:set-settings", settings),

  // 窗口操作
  showWindow: () => ipcRenderer.invoke("desktop:show-window"),
  minimizeToTray: () => ipcRenderer.invoke("desktop:minimize-to-tray"),

  // 快捷键事件监听
  onShortcut: (callback: (action: string) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      action: string
    ) => {
      callback(action);
    };
    ipcRenderer.on("shortcut-triggered", handler);
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeListener("shortcut-triggered", handler);
    };
  },
});