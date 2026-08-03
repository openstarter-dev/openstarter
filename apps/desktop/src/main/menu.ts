// apps/desktop/src/menu.ts —— 应用菜单模板（纯数据，无 Electron 运行时依赖）。
//
// 远程加载的页面在 Electron 里默认拿不到 Cmd+C / Cmd+V / Cmd+A —— 这些快捷键依赖应用
// 菜单中带 role 的菜单项存在。没有菜单，复制粘贴静默失效。因此这个模块不是可选项，
// 属于最小可用集（见 spec §5）。只做 `import type`，编译期擦除，不产生对 electron 的
// 运行时依赖，模板本身可在纯 Node 环境下被 vitest 覆盖。

import type { MenuItemConstructorOptions } from "electron";

/** 构造应用菜单模板。isMac 为 true 时加入 macOS 专属的 App 菜单与编辑菜单扩展项。 */
export function buildMenuTemplate(
  isMac: boolean
): MenuItemConstructorOptions[] {
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
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: [
      { role: "minimize" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  return [appMenu, fileMenu, editMenu, viewMenu, windowMenu].flat();
}
