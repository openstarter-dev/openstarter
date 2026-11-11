// 构建期 env（VITE_*，见 apps/extension/.env.example）→ 门面配置的解析层。
//
// 与移动端同一取舍：扩展是随商店分发的静态包，管理端改配置触达不到已安装的版本，
// 故供应商开关随构建固化（Vite 在打包时把 import.meta.env.VITE_* 内联进产物）。
// env 仍是外部输入（fork 者可能填任何值）：逐键校验类型、去空白，非法/缺失一律归零值，
// 任何输入都不抛错。

import { resolveHost } from "./internal/validators";

import type { ExtensionAnalyticsConfig } from "./internal/types";

/** 构建期 env 的形态：键固定、值可能缺失（import.meta.env 的常态）。 */
export type AnalyticsEnv = Record<string, string | undefined>;

/** env 键名 —— 与 apps/extension/.env.example 保持一致。 */
export const ANALYTICS_ENV_KEYS = {
  plausibleDomain: "VITE_ANALYTICS_PLAUSIBLE_DOMAIN",
  plausibleHost: "VITE_ANALYTICS_PLAUSIBLE_HOST",
  siteUrl: "VITE_APP_URL",
} as const;

/** Plausible 官方云端缺省 host（未配置或非法时回退）。 */
export const DEFAULT_PLAUSIBLE_HOST = "https://plausible.io";

/** 未配置任何供应商时的零值配置。 */
const DISABLED_CONFIG: ExtensionAnalyticsConfig = {
  plausibleDomain: "",
  plausibleHost: DEFAULT_PLAUSIBLE_HOST,
  siteUrl: "",
};

/** 读取字符串键：非 string 或缺失返回空串（不抛错）。 */
function readStringKey(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 解析扩展端分析 env（不信任输入 shape，永不抛错）。 */
export function resolveExtensionAnalyticsConfig(
  env: AnalyticsEnv | undefined | null,
): ExtensionAnalyticsConfig {
  if (!env || typeof env !== "object") {
    return DISABLED_CONFIG;
  }

  return {
    plausibleDomain: readStringKey(env[ANALYTICS_ENV_KEYS.plausibleDomain]),
    plausibleHost: resolveHost(
      readStringKey(env[ANALYTICS_ENV_KEYS.plausibleHost]),
      DEFAULT_PLAUSIBLE_HOST,
    ),
    siteUrl: readStringKey(env[ANALYTICS_ENV_KEYS.siteUrl]),
  };
}
