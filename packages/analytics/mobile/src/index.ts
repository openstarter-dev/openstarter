// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { configureAnalyticsErrors, initAnalytics, track } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
//
// provider 契约来自 @openstarter/analytics（跨平台统一），本包只做实现与组装。
//
// 出口刻意只含 facade + config 两层：provider 工厂与测试辅助
// （createNoopProvider / sanitizeGaEventName / resetAnalyticsForTests 等）
// 不进公共 API，需要时走 ./* 深路径导出（如 "@openstarter/analytics-mobile/facade"）。
export { resolveMobileAnalyticsConfig } from "./config";
export type { MobileAnalyticsConfig } from "./config";
export {
  configureAnalyticsErrors,
  identify,
  initAnalytics,
  reset,
  setScreenName,
  setUserId,
  track,
} from "./facade";
export type {
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsStrategyName,
  EventProperties,
  MobileAnalyticsProvider,
  UserTraits,
} from "./internal/types";
export type { ErrorReporterOptions } from "@openstarter/analytics/runtime";
