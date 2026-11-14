import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  retry: () => ipcRenderer.invoke("desktop:retry"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  getVersion: () => ipcRenderer.invoke("desktop:get-version"),

  authSignInEmail: (params: { email: string; password: string }) =>
    ipcRenderer.invoke("auth:sign-in-email", params),
  authSignInOAuth: (params: { provider: "google" | "github" }) =>
    ipcRenderer.invoke("auth:sign-in-oauth", params),
  authSignOut: () => ipcRenderer.invoke("auth:sign-out"),
  authGetSession: () => ipcRenderer.invoke("auth:get-session"),
  apiRequest: (request: { method: string; path: string; body?: unknown }) =>
    ipcRenderer.invoke("api:request", request),

  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke("desktop:open-file", options),
  saveFile: (data: string, options?: { defaultName?: string }) =>
    ipcRenderer.invoke("desktop:save-file", data, options),

  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  setSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke("desktop:set-settings", settings),

  showWindow: () => ipcRenderer.invoke("desktop:show-window"),
  minimizeToTray: () => ipcRenderer.invoke("desktop:minimize-to-tray"),

  onShortcut: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => {
      callback(action);
    };
    ipcRenderer.on("shortcut-triggered", handler);
    return () => {
      ipcRenderer.removeListener("shortcut-triggered", handler);
    };
  },
});
