// Plausible —— 供应商入口：把「脚本模板 / 运行时策略 / 配置判定」组装成定义。
//
// 判定用域名而非脚本 URL：域名决定供应商是否工作，URL 只影响脚本从哪加载
//（非法 URL 由 resolvePlausibleSrc 回退官方云端），两者不应互相牵连。

import { isValidPlausibleDomain, resolvePlausibleSrc } from "../../internal/validators";

import { plausibleScripts } from "./scripts";
import { createPlausibleStrategy } from "./strategy";

import type { WebAnalyticsProviderDefinition } from "../../internal/types";

export { plausibleScripts } from "./scripts";

/** web 端供应商定义：配置判定 = 域名通过安全白名单校验。 */
export const plausibleDefinition = {
  createStrategy: () => createPlausibleStrategy(),
  headScripts: (config) =>
    plausibleScripts(config.plausibleDomain, resolvePlausibleSrc(config.plausibleSrc)),
  isConfigured: (config) => isValidPlausibleDomain(config.plausibleDomain),
  name: "plausible",
} as const satisfies WebAnalyticsProviderDefinition;
