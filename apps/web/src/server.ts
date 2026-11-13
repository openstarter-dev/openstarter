import { app } from "@openstarter/api";
import { paraglideMiddleware } from "@openstarter/i18n-web/middleware";
import { deLocalizeUrl } from "@openstarter/i18n-web/runtime";
import handler from "@tanstack/react-start/server-entry";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { applyPageCacheHeaders } from "@/lib/page-cache";
import { setRpcFetchBridge } from "@/lib/rpc-bridge";

/**
 * SSR 期 RPC 的进程内桥接。
 *
 * 路由 loader 里的 `prefetchQuery` 会在服务端跑一次 queryFn，而客户端用的是相对 base
 * （`hcWithType("/")`），服务端 `fetch` 无法解析相对 URL。这里直接把请求交给同一个
 * Hono 实例，既修掉静默失败，也避免网络回环（Workers 同域自我请求多一跳且受限）。
 *
 * 两点关键：
 * 1. 必须转发当前请求的 Cookie / Authorization——桥接绕过浏览器 cookie jar，不转发的话
 *    受保护接口一律 401，而 prefetch 不抛错，会静默退化成空首屏。`getRequestHeaders()`
 *    走框架的 AsyncLocalStorage 请求上下文，并发安全。
 * 2. origin 用固定值：Hono 路由不依赖 host，也避免跨请求共享可变状态。
 */
const INTERNAL_RPC_ORIGIN = "http://web.internal";

setRpcFetchBridge(async (input, init) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  const headers = new Headers(getRequestHeaders());
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

  return app.fetch(new Request(new URL(raw, INTERNAL_RPC_ORIGIN), { ...init, headers }));
});

const CF_WORKERS_MODULE = "cloudflare:workers";
let cfEnvPromise: Promise<void> | null = null;

function ensureCloudflareEnv(): Promise<void> {
  if (!cfEnvPromise) {
    cfEnvPromise = import(/* @vite-ignore */ CF_WORKERS_MODULE)
      .then((mod) => {
        (globalThis as unknown as { __CF_ENV__?: unknown }).__CF_ENV__ = mod.env;
      })
      .catch(() => {
      });
  }
  return cfEnvPromise;
}

export default {
  async fetch(request: Request): Promise<Response> {
    await ensureCloudflareEnv();
    const response = await paraglideMiddleware(request, () => handler.fetch(request));
    const canonicalPath = deLocalizeUrl(new URL(request.url)).pathname;
    return applyPageCacheHeaders(canonicalPath, request.method, response);
  },
};
