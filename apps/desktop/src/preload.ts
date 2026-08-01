// apps/desktop/src/preload.ts —— 唯一的主进程/渲染进程桥。
//
// 通过 contextBridge 暴露最小 API，不暴露任何 Node 原语。retry() 只服务于兜底页
// （resources/offline.html）：远程站点页面虽然也能看到 window.desktop，但 retry()
// 只能触发主进程重新加载已白名单的 URL，不构成额外攻击面（见 spec §4）。
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  retry: () => ipcRenderer.invoke("desktop:retry"),
});
