import type { MenuItemConstructorOptions } from "electron";

/** 构造应用菜单模板。isMac 为 true 时加入 macOS 专属的 App 菜单与编辑菜单扩展项。
 * isDev 为 true 时在 View 菜单追加 Toggle Developer Tools（显式绑定 CmdOrCtrl+Alt+I，
 * 即 macOS 的 Cmd+Option+I），方便 dev 模式排查渲染进程问题；prod 包默认不带。 */
export function buildMenuTemplate(isMac: boolean, isDev = false): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: "OpenStarter",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [isMac ? { role: "close" } : { role: "quit" }],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      ...(isDev
        ? [
            { type: "separator" } as MenuItemConstructorOptions,
            {
              role: "toggleDevTools",
              accelerator: "CmdOrCtrl+Alt+I",
            } as MenuItemConstructorOptions,
          ]
        : []),
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: [{ role: "minimize" }, isMac ? { role: "close" } : { role: "quit" }],
  };

  return [appMenu, fileMenu, editMenu, viewMenu, windowMenu].flat();
}
