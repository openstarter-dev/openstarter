// apps/desktop/src/main/config.ts —— 简化版，只保留运行模式判断和更新开关。
// 桌面端不再加载远程 URL，改为加载本地构建产物或 Vite dev server。

export type DesktopMode = "dev" | "prod";

/** 依据 app.isPackaged 判断运行模式。 */
export function getDesktopMode(isPackaged: boolean): DesktopMode {
  return isPackaged ? "prod" : "dev";
}

/** 是否显式关闭自动更新检查（OPENSTARTER_DESKTOP_DISABLE_UPDATER=true）。 */
export function isUpdaterDisabled(
  env: Record<string, string | undefined>
): boolean {
  return env.OPENSTARTER_DESKTOP_DISABLE_UPDATER === "true";
}