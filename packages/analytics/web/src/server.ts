// @openstarter/analytics-web/server —— 分析配置读取（R25.1 / R25.2）。
//
// 经类型化 RPC（`hc<AppType>`）调用**公开只读**端点 `GET /api/analytics/config` 读取分析供应商
// 标识与度量 ID，供根路由依据其**条件注入**采集脚本。数据面走 analytics-web → AppType（RPC）
// → packages/api → Analytics 服务，不直接导入服务模块或 db。
//
// 框架无关：本入口只导出 `createAnalyticsConfigLoader`，把「读配置 + TTL 缓存」封装成普通异步函数。
// 服务端函数绑定（`createServerFn`）由宿主 Web 应用持有（apps/web/src/functions/analytics.ts），
// 平台包不反向依赖 @tanstack/react-start。
//
// SSR 说明：读取器以内存方式将请求分派给已挂载的 Hono `app`（`app.fetch`），避免在 SSR 期
// 解析部署 origin/端口；`app` 仅在读取器执行时**动态导入**，不进入客户端产物。
// 度量 ID 本随页面 HTML 公开，故读取的分析配置为非敏感数据。
//
// 缓存：命中/失败语义见 ./internal/config-cache（失败不缓存，避免抖动导致长时间断送）。

import { createAnalyticsConfigCache, EMPTY_ANALYTICS_CONFIG } from "./internal/config-cache";

import type { AnalyticsConfig } from "./internal/types";

import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

// 内存 RPC 基址：主机名仅用于构造合法 URL，Hono 依 pathname 路由；请求经 `app.fetch` 就地分派。
const INTERNAL_RPC_BASE = "http://analytics.internal";

// 默认配置缓存 TTL：管理员改配置后最多 30s 生效，可接受。
const DEFAULT_TTL_MS = 30_000;

async function createRpc() {
  const { app } = await import("@openstarter/api");
  return hc<AppType>(INTERNAL_RPC_BASE, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

/** 读取配置；读取失败返回 undefined（与「确实未配置」区分，见 config-cache）。 */
async function fetchAnalyticsConfig(): Promise<AnalyticsConfig | undefined> {
  try {
    const rpc = await createRpc();
    const res = await rpc.api.analytics.config.$get();
    if (!res.ok) {
      return undefined;
    }
    const json = await res.json();
    // 端点正常返回但无数据 = 确实未配置供应商：这是合法状态，可以缓存。
    return json.data ?? EMPTY_ANALYTICS_CONFIG;
  } catch {
    // 配置读取失败不阻塞页面渲染：本次视为未配置，不写缓存。
    return undefined;
  }
}

export interface AnalyticsConfigLoaderOptions {
  /** 缓存有效期（毫秒），默认 30s。 */
  ttlMs?: number;
}

/**
 * 创建公开分析配置读取器（含 TTL 缓存）；失败或无数据时回退为空配置（不注入任何脚本）。
 *
 * 缓存槽随读取器实例存在：调用方应**每进程创建一次**并复用，否则每次调用都会得到
 * 彼此独立的空缓存，TTL 形同失效。
 */
export function createAnalyticsConfigLoader(
  options: AnalyticsConfigLoaderOptions = {},
): () => Promise<AnalyticsConfig> {
  const configCache = createAnalyticsConfigCache({ ttlMs: options.ttlMs ?? DEFAULT_TTL_MS });
  return () => configCache.get(fetchAnalyticsConfig);
}
