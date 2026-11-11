// @openstarter/analytics —— 公开出口。
//
// 主入口 = 类型契约 + 事件常量（零平台依赖、无副作用）；跨平台运行时工具在
// 子入口 "@openstarter/analytics/runtime"。
export { ANALYTICS_EVENTS } from "./events";
export type { AnalyticsEventName } from "./events";
export type {
  AnalyticsErrorContext,
  AnalyticsErrorHandler,
  AnalyticsMethod,
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsServerStrategy,
  AnalyticsStrategyName,
  EventProperties,
  UserTraits,
} from "./types";
