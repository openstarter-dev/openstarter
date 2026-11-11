// @openstarter/analytics-web/internal —— 包内类型（不进包出口，仅包内模块引用）。
//
// 跨平台契约（AnalyticsProvider / EventProperties / UserTraits）在 @openstarter/analytics；
// 本文件只放 web 特有的两件东西：
//   1. AnalyticsConfig —— 由服务端公开配置端点下发的供应商标识（apps/web 经 SSR 读取）；
//   2. WebAnalyticsProviderDefinition —— 供应商定义。web 端一个供应商是「脚本注入 + 运行时
//      策略」两件事，放在同一 definition 里是为了让两者共享同一套配置判定：否则会出现
//      「注入了脚本但运行时策略未启用」这类只在生产才暴露的错配。
//
// 放在 internal/ 而非 src 根：根目录只保留对外入口（index / scripts / strategy / server），
// 这两个模块是实现细节，消费方不应直接 import。

import type { AnalyticsProvider, AnalyticsProviderName } from "@openstarter/analytics";

/** 从后端读取的分析供应商配置（空字符串表示未配置对应供应商）。 */
export interface AnalyticsConfig {
  googleAnalyticsId: string;
  plausibleDomain: string;
  plausibleSrc: string;
}

/**
 * TanStack Router `head().scripts` 的单项描述（扁平形态）：
 * `src` → 外部脚本；`children` → 内联脚本内容；其余字段作为 `<script>` 属性透传。
 */
export interface HeadScript {
  async?: boolean;
  children?: string;
  "data-domain"?: string;
  defer?: boolean;
  id?: string;
  src?: string;
}

/**
 * web 端供应商定义 —— 每个供应商目录导出一个，由 `providers/index.ts` 汇总为注册表。
 * 三个成员必须同时满足：`isConfigured` 为真 ⇔ 脚本会注入 ⇔ 运行时策略可用。
 */
export interface WebAnalyticsProviderDefinition {
  readonly name: AnalyticsProviderName;
  /** 配置是否足以启用该供应商（同时用于脚本注入与运行时策略，避免两者判定漂移）。 */
  readonly isConfigured: (config: AnalyticsConfig) => boolean;
  /** 要注入到 `head().scripts` 的脚本描述（纯模板构造，不触碰 DOM）。 */
  readonly headScripts: (config: AnalyticsConfig) => HeadScript[];
  /** 运行时策略：读取脚本注入后暴露的全局对象；全局不存在时安全 no-op。 */
  readonly createStrategy: (config: AnalyticsConfig) => AnalyticsProvider;
}
