// Google Analytics —— 供应商入口：把「脚本模板 / 运行时策略 / 配置判定」组装成定义。
//
// 三者同源是刻意的：isConfigured 为真 ⇔ 脚本会注入 ⇔ 运行时策略可用。
// 分开判定过一次就出现过「注入了脚本但运行时未启用」这类只在生产暴露的错配，
// 因此这里把三块放在同一目录、由同一个定义对外。

import { isValidMeasurementId } from "../../internal/validators";

import { googleAnalyticsScripts } from "./scripts";
import { createGoogleAnalyticsStrategy } from "./strategy";

import type { WebAnalyticsProviderDefinition } from "../../internal/types";

export { googleAnalyticsScripts } from "./scripts";

/** web 端供应商定义：配置判定 = 度量 ID 通过安全白名单校验。 */
export const googleAnalyticsDefinition = {
  createStrategy: () => createGoogleAnalyticsStrategy(),
  headScripts: (config) => googleAnalyticsScripts(config.googleAnalyticsId),
  isConfigured: (config) => isValidMeasurementId(config.googleAnalyticsId),
  name: "google-analytics",
} as const satisfies WebAnalyticsProviderDefinition;
