// Plausible —— 扩展端供应商实现（HTTP 直发，无 SDK）。
//
// 为什么不用 gtag/posthog 这类脚本型供应商：MV3 禁止远程代码，扩展页面无法注入外部脚本
// （CWS 也不允许）。Plausible 的事件端点是一次普通 `fetch`，是少数能在扩展里合法工作的方案。
//
// 身份语义与 web 端一致：Plausible 没有服务端身份概念，identify 结果只能作为后续事件的
// props 附带，且仅存活于本次运行（service worker 回收即失效）。与 web 端同样只透传低基数
// 画像（plan / role）——高基数 userId 会让报表被打散，也避免 PII 扩散。
//
// 错误处理：网络失败 / 非 2xx 一律不抛错，但会交给 report（facade 传入的 onError/debug），
// 否则「扩展没数据」时无从排查。

import { errorContext, sanitizeProperties } from "@openstarter/analytics/runtime";

import { isValidPlausibleDomain, isValidSiteUrl } from "../../internal/validators";

import type { AnalyticsProvider, EventProperties, UserTraits } from "@openstarter/analytics";
import type { ReportError } from "@openstarter/analytics/runtime";

import type {
  ExtensionAnalyticsConfig,
  ExtensionAnalyticsPorts,
  ExtensionAnalyticsProviderDefinition,
  FetchLike,
} from "../../internal/types";

const EVENT_ENDPOINT = "/api/event";
/** Plausible 的页面事件规范名（无下划线），对应语义常量 ANALYTICS_EVENTS.PAGE_VIEW。 */
const PLAUSIBLE_PAGEVIEW = "pageview";

/** 允许作为事件属性透传的低基数画像字段（与 web 端一致）。 */
const LOW_CARDINALITY_TRAITS = ["plan", "role"] as const;

/** 取注入的 fetch；未注入且运行时不提供 fetch 时返回 undefined（调用处安全 no-op）。 */
function resolveFetch(ports: ExtensionAnalyticsPorts): FetchLike | undefined {
  if (ports.fetch) {
    return ports.fetch;
  }
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  return typeof globalFetch === "function" ? (globalFetch as FetchLike) : undefined;
}

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

export function createPlausibleProvider(
  config: ExtensionAnalyticsConfig,
  ports: ExtensionAnalyticsPorts,
  report?: ReportError,
): AnalyticsProvider {
  const doFetch = resolveFetch(ports);
  let identity: Record<string, unknown> = {};

  const send = async (event: string, properties?: EventProperties): Promise<void> => {
    if (!doFetch) {
      return;
    }

    const props = sanitizeProperties({ ...identity, ...properties });

    try {
      const response = await doFetch(`${config.plausibleHost}${EVENT_ENDPOINT}`, {
        body: JSON.stringify({
          domain: config.plausibleDomain,
          name: event,
          url: config.siteUrl,
          ...(props ? { props } : {}),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        report?.(
          new Error(`Plausible responded with ${response.status}`),
          errorContext("plausible", "track"),
        );
      }
    } catch (error) {
      report?.(error, errorContext("plausible", "track"));
    }
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
      await send(PLAUSIBLE_PAGEVIEW, { path: name, ...params });
    },
    async track(event, properties) {
      await send(event, properties);
    },
  };
}

/** 供应商定义：配置判定 = 域名合规 且 站点 URL 合规（缺一 Plausible 都会丢弃事件）。 */
export const plausibleDefinition = {
  createStrategy: (config, ports, report) => createPlausibleProvider(config, ports, report),
  isConfigured: (config) =>
    isValidPlausibleDomain(config.plausibleDomain) && isValidSiteUrl(config.siteUrl),
  name: "plausible",
} as const satisfies ExtensionAnalyticsProviderDefinition;
