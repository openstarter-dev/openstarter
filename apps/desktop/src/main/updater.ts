// apps/desktop/src/updater.ts —— 自动更新策略（纯函数）+ electron-updater 调用封装。
//
// shouldCheckForUpdates/hasPublishConfig 是纯函数，可在纯 Node 环境下被 vitest 覆盖。
// maybeCheckForUpdates 用动态 import 引入 electron-updater，使这个文件的顶层不产生
// 对 electron-updater 的静态依赖（该依赖只在 main.ts 实际调用时才加载）。
// 详见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §7。
import { existsSync } from "node:fs";
import { join } from "node:path";

import { isUpdaterDisabled } from "./config";
import { logError, logInfo, logWarn } from "./log";

interface ShouldCheckParams {
  disabled: boolean;
  hasPublishConfig: boolean;
  isPackaged: boolean;
}

/** 三个条件必须同时满足才检查更新：已打包、未被显式禁用、存在可用的更新源配置。 */
export function shouldCheckForUpdates(params: ShouldCheckParams): boolean {
  return params.isPackaged && !params.disabled && params.hasPublishConfig;
}

/**
 * 检查打包资源目录下是否存在 electron-builder 生成的 app-update.yml。
 * 该文件缺失通常意味着模板使用者尚未配置 publish 字段或没跑过带 publish 的打包命令。
 */
export function hasPublishConfig(resourcesPath: string): boolean {
  return existsSync(join(resourcesPath, "app-update.yml"));
}

/**
 * 在满足 shouldCheckForUpdates 条件时触发一次检查。失败只记日志，不弹框
 * （远程模式下网络本就不稳，见 spec §7）。
 */
export async function maybeCheckForUpdates(isPackaged: boolean): Promise<void> {
  const disabled = isUpdaterDisabled(process.env);
  const configExists = hasPublishConfig(process.resourcesPath);

  if (
    !shouldCheckForUpdates({
      disabled,
      hasPublishConfig: configExists,
      isPackaged,
    })
  ) {
    if (isPackaged && !disabled && !configExists) {
      logWarn("no publish config found; skipping update check.");
    }
    return;
  }

  try {
    const { autoUpdater } = await import("electron-updater");
    autoUpdater.logger = {
      debug: logInfo,
      error: logError,
      info: logInfo,
      warn: logWarn,
    };
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    logError("update check failed", error);
  }
}
