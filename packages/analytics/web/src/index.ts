// @openstarter/analytics-web public entry points.
// @openstarter/analytics-web —— 客户端公开出口。
//
// Entry points (package.json exports) / 三个入口分工：
//   - "."              Runtime strategy / 运行时策略（createAnalyticsStrategy）：浏览器侧 track/identify/reset
//   - "./scripts"      Head script injection / 脚本注入（buildAnalyticsHeadScripts）：SSR 期交给 Router 的 head().scripts
//   - "./server-track" Server event tracking / 服务端事件上报（createGA4ServerStrategy）：支付/订阅等只能后端确认的事件

export { createAnalyticsStrategy } from "./strategy";
export type { AnalyticsConfig, HeadScript, WebAnalyticsProviderDefinition } from "./internal/types";
export type {
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsStrategyName,
  EventProperties,
  UserTraits,
} from "@openstarter/analytics";
