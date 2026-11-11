// @openstarter/analytics-web —— 运行时策略解析（契约实现入口）。
//
// 与 scripts.ts 共用同一张供应商注册表与同一份配置判定，因此「注入了哪些脚本」与
// 「运行时会上报到哪些供应商」恒等。配置缺失/全部不合规时返回 noop，消费方无需判空。
//
// 注意：这里只解析策略，不注入脚本——脚本注入是 SSR 期 `head().scripts` 的职责
// （apps/web 在 __root.tsx 调用 buildAnalyticsHeadScripts），两者在同一份配置下配合完成采集。
//
// **缓存**：策略实例内部有状态（Plausible 的画像闭包），每次调用都新建实例会导致
// 身份在两次调用之间丢失。因此按配置内容做模块级缓存：同一份配置恒返回同一个实例。
// 配置变化（管理后台改标识）会产生新 key 并重建策略。

import { createCompositeProvider, createNoopProvider } from "@openstarter/analytics/runtime";

import { WEB_ANALYTICS_PROVIDERS } from "./providers";

import type { AnalyticsConfig } from "./internal/types";

import type { AnalyticsProvider } from "@openstarter/analytics";

let cached: { key: string; value: AnalyticsProvider } | undefined;

/** 配置 → 缓存键（内容相等即同一实例）。 */
function toCacheKey(config: AnalyticsConfig | undefined): string {
  return config === undefined
    ? ""
    : [config.googleAnalyticsId, config.plausibleDomain, config.plausibleSrc].join("\u0000");
}

function buildStrategy(config: AnalyticsConfig | undefined): AnalyticsProvider {
  if (!config) {
    return createNoopProvider();
  }

  const active = WEB_ANALYTICS_PROVIDERS.filter((provider) => provider.isConfigured(config));
  const [first] = active;

  if (first === undefined) {
    return createNoopProvider();
  }

  if (active.length === 1) {
    return first.createStrategy(config);
  }

  return createCompositeProvider(active.map((provider) => provider.createStrategy(config)));
}

/** 按配置解析运行时策略：无供应商 → noop；单供应商 → 直返；多供应商 → composite。 */
export function createAnalyticsStrategy(config: AnalyticsConfig | undefined): AnalyticsProvider {
  const key = toCacheKey(config);

  if (cached?.key === key) {
    return cached.value;
  }

  const value = buildStrategy(config);
  cached = { key, value };
  return value;
}

/** 仅测试用：清空模块级缓存槽（避免用例间共享有状态的策略实例）。 */
export function resetAnalyticsStrategyForTests(): void {
  cached = undefined;
}
