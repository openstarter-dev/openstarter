// @openstarter/analytics-web —— 客户端公开出口。
//
// 三个入口分工（package.json exports）：
//   - "."              运行时策略（createAnalyticsStrategy）：浏览器侧 track/identify/reset
//   - "./scripts"      脚本注入（buildAnalyticsHeadScripts）：SSR 期交给 Router 的 head().scripts
//   - "./server"       公开配置读取（createAnalyticsConfigLoader）：框架无关，宿主用 createServerFn 包裹
//   - "./server-track" 服务端事件上报（createGA4ServerStrategy）：支付/订阅等只能后端确认的事件
// 拆开是为了让每处只 import 自己需要的部分——客户端产物不会因 import 策略而拉入服务端 RPC，
// 也不会把 Measurement Protocol 的 api_secret 相关代码带进浏览器包。
//
// 与 "./scripts" 的边界：脚本相关 API（模板/校验/注入描述）只在 "./scripts" 暴露，
// 本入口不再重复导出，避免两个入口同一函数两种用法。

export { createAnalyticsStrategy } from "./strategy";
export type { AnalyticsConfig, HeadScript, WebAnalyticsProviderDefinition } from "./internal/types";
export type {
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsStrategyName,
  EventProperties,
  UserTraits,
} from "@openstarter/analytics";
