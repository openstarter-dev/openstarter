// @openstarter/analytics-web/server-track —— 服务端事件上报（GA4 Measurement Protocol）。
//
// 为什么需要独立的服务端通道：支付成功、订阅变更、退款这类事实只有后端能确认
//（客户端上报会被中途关闭、支付回调不经过浏览器），它们也是最值钱的转化数据。
//
// 与客户端策略的差异：
//   - 只有 track（AnalyticsServerStrategy），没有 identify/reset/setScreenName；
//   - 必须显式传 measurementId + apiSecret（对应 GA4 的 Measurement Protocol 密钥），
//     由调用方从服务端 env 注入——本模块不读 process.env，便于测试且不会误进客户端产物。
//
// 错误语义与客户端一致：永不抛错。失败可通过 onError 接出去（如 logger / Sentry）。

import { sanitizeProperties } from "@openstarter/analytics/runtime";

import type { AnalyticsServerStrategy } from "@openstarter/analytics";

/** 最小 fetch 契约（避免依赖 DOM lib；测试注入桩即可）。 */
export type ServerFetchLike = (
  input: string,
  init: { body: string; headers: Record<string, string>; method: "POST" },
) => Promise<{ ok: boolean; status: number }>;

/** GA4 Measurement Protocol 收集端点。 */
const DEFAULT_ENDPOINT = "https://www.google-analytics.com/mp/collect";

/** 事件属性里用于指定 client_id 的键（GA4 要求每条事件归属一个 client_id）。 */
const CLIENT_ID_KEY = "clientId";

export interface GA4ServerOptions {
  /** GA4 度量 ID（G-XXXX），与服务端 secret 一起构成上报凭据。 */
  measurementId: string;
  /** GA4 Measurement Protocol API secret（服务端专用，绝不进客户端产物）。 */
  apiSecret: string;
  /** 端点覆盖（自建代理/测试用）。 */
  endpoint?: string;
  /** fetch 注入（测试用；缺省用 globalThis.fetch）。 */
  fetch?: ServerFetchLike;
  /** 失败出口（默认静默，保持「上报不得影响业务」）。 */
  onError?: (error: unknown) => void;
}

function resolveFetch(override?: ServerFetchLike): ServerFetchLike | undefined {
  if (override) {
    return override;
  }
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  return typeof globalFetch === "function" ? (globalFetch as ServerFetchLike) : undefined;
}

/** 生成 client_id：优先用运行时 UUID，退化到时间戳随机串。 */
function createClientId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGA4ServerStrategy(options: GA4ServerOptions): AnalyticsServerStrategy {
  const { measurementId, apiSecret, endpoint = DEFAULT_ENDPOINT, onError } = options;
  const doFetch = resolveFetch(options.fetch);

  return {
    async track(event, properties) {
      if (!doFetch) {
        return;
      }

      const params = sanitizeProperties(properties) ?? {};
      const explicitClientId = params[CLIENT_ID_KEY];
      const clientId =
        typeof explicitClientId === "string" && explicitClientId !== ""
          ? explicitClientId
          : createClientId();

      // clientId 只用于归属，不作为事件参数重复上报。
      delete params[CLIENT_ID_KEY];

      const url = `${endpoint}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

      try {
        const response = await doFetch(url, {
          body: JSON.stringify({
            client_id: clientId,
            events: [{ name: event, params }],
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          onError?.(new Error(`GA4 Measurement Protocol responded with ${response.status}`));
        }
      } catch (error) {
        onError?.(error);
      }
    },
  };
}
