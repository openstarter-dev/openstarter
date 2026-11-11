// @openstarter/analytics-extension —— 浏览器扩展分析统一出口。
//
// 消费方（apps/extension）只 import 本包：
//   configureAnalyticsErrors({ debug: import.meta.env.DEV });
//   initAnalytics(resolveExtensionAnalyticsConfig(import.meta.env));
// 不直接依赖任何供应商协议细节。
//
// provider 契约来自 @openstarter/analytics（跨平台统一），本包只做实现与组装。
export { resolveExtensionAnalyticsConfig, ANALYTICS_ENV_KEYS } from "./config";
export type { AnalyticsEnv } from "./config";
export {
  configureAnalyticsErrors,
  identify,
  initAnalytics,
  reset,
  setScreenName,
  track,
} from "./facade";
export type {
  ExtensionAnalyticsConfig,
  ExtensionAnalyticsPorts,
  ExtensionAnalyticsProviderDefinition,
  FetchLike,
} from "./internal/types";
export type { ErrorReporterOptions } from "@openstarter/analytics/runtime";
export type {
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsStrategyName,
  EventProperties,
  UserTraits,
} from "@openstarter/analytics";
