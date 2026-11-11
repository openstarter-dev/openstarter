// @openstarter/analytics-extension/internal —— 平台内类型（包内模块，对外经 ../index.ts 转出）。
//
// 跨平台契约（AnalyticsProvider / EventProperties / UserTraits）在 @openstarter/analytics；
// 本文件只声明扩展端特有的三件事：构建期配置、fetch 注入点、供应商定义。

import type { AnalyticsProvider, AnalyticsProviderName } from "@openstarter/analytics";
import type { ReportError } from "@openstarter/analytics/runtime";

/**
 * 扩展端分析配置（构建期 env 归一，见 config.ts）。
 *
 * `siteUrl` 是 Plausible 的硬要求：它按 `domain` 校验事件的 `url` 归属。扩展页面自身的
 * 协议是 `chrome-extension://`，不属于任何站点，因此事件必须挂到产品站点 URL 下——
 * 这也意味着**未配置 siteUrl 时不启用**（宁可不采，也不上报会被供应商丢弃的事件）。
 */
export interface ExtensionAnalyticsConfig {
  plausibleDomain: string;
  plausibleHost: string;
  siteUrl: string;
}

/**
 * 最小 fetch 契约：只声明本包用到的形状。
 * 不直接用 DOM 的 `typeof fetch`，是为了让包（及其测试）不依赖 DOM lib——
 * 扩展的 service worker 与页面共享同一份代码，但类型环境不同。
 */
export type FetchLike = (
  input: string,
  init: { body: string; headers: Record<string, string>; method: "POST" },
) => Promise<{ ok: boolean; status: number }>;

/** 依赖注入点：测试注入 fetch 桩；生产缺省用 globalThis.fetch。 */
export interface ExtensionAnalyticsPorts {
  fetch?: FetchLike;
}

/** 供应商定义 —— 与 analytics-web 的同名概念对齐：配置判定与策略构造同源。 */
export interface ExtensionAnalyticsProviderDefinition {
  readonly name: AnalyticsProviderName;
  /** 配置是否足以启用该供应商（脚本/上报共用同一判定，避免两处漂移）。 */
  readonly isConfigured: (config: ExtensionAnalyticsConfig) => boolean;
  /**
   * 构造策略。`report` 由 facade 注入：provider 内部吞掉的失败（网络/非 2xx）必须
   * 走同一个错误出口，否则「扩展没数据」时完全无痕。
   */
  readonly createStrategy: (
    config: ExtensionAnalyticsConfig,
    ports: ExtensionAnalyticsPorts,
    report?: ReportError,
  ) => AnalyticsProvider;
}
