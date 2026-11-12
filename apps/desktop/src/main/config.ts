export type DesktopMode = "dev" | "prod";

/** 依据 app.isPackaged 判断运行模式。 */
export function getDesktopMode(isPackaged: boolean): DesktopMode {
  return isPackaged ? "prod" : "dev";
}

/** 是否显式关闭自动更新检查（OPENSTARTER_DESKTOP_DISABLE_UPDATER=true）。 */
export function isUpdaterDisabled(env: Record<string, string | undefined>): boolean {
  return env.OPENSTARTER_DESKTOP_DISABLE_UPDATER === "true";
}
