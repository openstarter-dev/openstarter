// @openstarter/analytics-web/scripts —— 分析脚本条件注入（R25.1、R25.2）。
//
// 依据分析供应商标识，构造经 TanStack Router `head().scripts` 注入的采集脚本描述。
// 本模块为**纯函数**（无副作用、无 I/O），输入为已读取的分析配置，输出为脚本描述数组；
// 不依赖任何运行时框架或后端，可被任何采用 TanStack Router `head().scripts` 机制的 web 应用复用。
//
// 供应商实现位于 providers/*（脚本模板 + 运行时策略 + 配置判定同源），本模块只做
// 「按注册表聚合」——新增供应商不需要改这里。
//
// 安全（XSS）约束：
//   - **受控白名单**：注入脚本只能来自注册表中的固定供应商；未知/未配置供应商一律不注入。
//   - **标识校验**：插值进内联脚本的度量 ID 仅允许 `[A-Za-z0-9_-]`，Plausible 域名仅允许
//     `[A-Za-z0-9.,_-]`；任一不合规即跳过该供应商，绝不将任意配置字符串原样作为可执行
//     脚本注入（杜绝断开引号/标签的注入）。
//   - **脚本 URL 约束**：Plausible 自托管脚本 URL 必须为合法 https 绝对 URL，否则回退官方默认。
//   - 经框架的 `head().scripts` 机制注入（由 Router 统一管理 `<script>` 标签），而非在组件内
//     直接使用危险的 innerHTML。

import { WEB_ANALYTICS_PROVIDERS } from "./providers";

import type { AnalyticsConfig, HeadScript } from "./internal/types";

export type { AnalyticsConfig, HeadScript } from "./internal/types";
export {
  isValidMeasurementId,
  isValidPlausibleDomain,
  resolvePlausibleSrc,
} from "./internal/validators";
export { googleAnalyticsScripts } from "./providers/google-analytics";
export { plausibleScripts } from "./providers/plausible";
export { WEB_ANALYTICS_PROVIDERS } from "./providers";

/**
 * 依据分析配置构造要注入的脚本描述数组（R25.1、R25.2）：
 *   - 配置了某供应商（且标识合规）→ 注入且仅注入该供应商对应的脚本；
 *   - 未配置任何供应商（或标识不合规）→ 返回空数组，即不注入任何分析脚本。
 */
export function buildAnalyticsHeadScripts(config: AnalyticsConfig | undefined): HeadScript[] {
  if (!config) {
    return [];
  }

  return WEB_ANALYTICS_PROVIDERS.filter((provider) => provider.isConfigured(config)).flatMap(
    (provider) => provider.headScripts(config),
  );
}
