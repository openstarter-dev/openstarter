// Plausible —— 运行时策略（读取脚本注入后暴露的 window.plausible）。
//
// Plausible **没有服务端身份概念**：官方 API 只接受事件 + 自定义 props。因此 identify 不做
// 伪上报（那会污染事件流），而是把**低基数画像**记在闭包里，由后续事件以 props 附带。
//
// 为什么只保留白名单字段：Plausible 的自定义属性按值建立维度，把 userId / email 这类高基数
// 值塞进每个事件会让报表被打散（每个用户一个维度值），同时把 PII 扩散到全部事件属性里。
// 因此这里只透传 plan / role 这类真正用于分群的字段；身份追踪请走 GA4 之类的供应商。
//
// 代价是身份不跨页面生命周期——这是供应商能力边界，不是实现取巧。

import { sanitizeProperties } from "@openstarter/analytics/runtime";

import type { AnalyticsProvider, UserTraits } from "@openstarter/analytics";

/**
 * Plausible 的页面事件规范名是 `pageview`（无下划线），对应语义常量
 * ANALYTICS_EVENTS.PAGE_VIEW；供应商原生名不可改，故在此显式映射。
 */
const PLAUSIBLE_PAGEVIEW = "pageview";

/** 允许作为事件属性透传的画像字段（低基数、非 PII）。 */
const LOW_CARDINALITY_TRAITS = ["plan", "role"] as const;

interface PlausibleOptions {
  props?: Record<string, unknown>;
  u?: string;
}

declare global {
  interface Window {
    plausible?: (event: string, options?: PlausibleOptions) => void;
  }
}

/** 只挑出低基数画像字段。 */
function pickLowCardinalityTraits(traits: UserTraits | undefined): Record<string, unknown> {
  if (!traits) {
    return {};
  }

  const picked: Record<string, unknown> = {};
  for (const key of LOW_CARDINALITY_TRAITS) {
    if (key in traits) {
      picked[key] = traits[key];
    }
  }
  return picked;
}

export function createPlausibleStrategy(): AnalyticsProvider {
  let identity: Record<string, unknown> = {};

  const send = (event: string, properties?: Record<string, unknown>): void => {
    if (typeof window === "undefined" || typeof window.plausible !== "function") {
      return;
    }

    const props = sanitizeProperties({ ...identity, ...properties });
    window.plausible(event, props ? { props } : undefined);
  };

  return {
    async identify(_profileId, traits) {
      identity = pickLowCardinalityTraits(traits);
    },
    name: "plausible",
    async reset() {
      identity = {};
    },
    async setScreenName(name, params) {
      send(PLAUSIBLE_PAGEVIEW, { path: name, ...params });
    },
    async track(event, properties) {
      send(event, properties);
    },
  };
}
