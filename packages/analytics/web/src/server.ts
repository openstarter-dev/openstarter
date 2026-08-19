// @openstarter/analytics-web —— 分析配置 SSR 加载（R25.1 / R25.2）。
//
// 经类型化 RPC（`hc<AppType>`）调用**公开只读**端点 `GET /api/analytics/config` 读取分析供应商
// 标识与度量 ID，供根路由依据其**条件注入**采集脚本。数据面走 analytics-web → AppType（RPC）
// → packages/api → Analytics 服务，不直接导入服务模块或 db。
//
// SSR 说明：在 server function 内以内存方式将请求分派给已挂载的 Hono `app`（`app.fetch`），
// 避免在 SSR 期解析部署 origin/端口；`app` 仅在服务端 handler 内**动态导入**，不进入客户端产物。
// 度量 ID 本随页面 HTML 公开，故读取的分析配置为非敏感数据。
//
// 依赖说明：`@openstarter/api` 仅用作类型与运行时分派目标，不在客户端产物中保留
//（`createServerFn` 与 `app` 动态导入都在服务端运行）。

import type { AppType } from "@openstarter/api";
import { createServerFn } from "@tanstack/react-start";
import { hc } from "hono/client";

import type { AnalyticsConfig } from "./scripts";

// 内存 RPC 基址：主机名仅用于构造合法 URL，Hono 依 pathname 路由；请求经 `app.fetch` 就地分派。
const INTERNAL_RPC_BASE = "http://analytics.internal";

// 读取失败或无数据时的兜底：视为「未配置任何供应商」，即不注入任何脚本（R25.2）。
const EMPTY_ANALYTICS_CONFIG: AnalyticsConfig = {
  googleAnalyticsId: "",
  plausibleDomain: "",
  plausibleSrc: "",
};

async function createRpc() {
  const { app } = await import("@openstarter/api");
  return hc<AppType>(INTERNAL_RPC_BASE, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

/** 读取公开分析配置；失败或无数据时回退为空配置（不注入任何脚本）。 */
export const getAnalyticsConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyticsConfig> => {
    const rpc = await createRpc();
    const res = await rpc.api.analytics.config.$get();
    if (!res.ok) {
      return EMPTY_ANALYTICS_CONFIG;
    }
    const json = await res.json();
    return json.data ?? EMPTY_ANALYTICS_CONFIG;
  },
);
