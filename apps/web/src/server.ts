// Custom server entry — TanStack Start auto-detects `src/server.ts` and uses it
// as the SSR request handler. Wrapping every request in Paraglide's middleware
// keeps getLocale() request-scoped (AsyncLocalStorage) during SSR so the active
// locale (URL prefix / cookie / baseLocale) is available while rendering.
//
// The router (src/router.tsx) already localizes/de-localizes URLs via its
// `rewrite` option, so we pass the ORIGINAL request to the framework handler
// (not Paraglide's de-localized one) to avoid a double-rewrite redirect loop.
// Requirements: 23.3, 23.4.

import { paraglideMiddleware } from "@openstarter/i18n-web/middleware";
import { deLocalizeUrl } from "@openstarter/i18n-web/runtime";
import handler from "@tanstack/react-start/server-entry";

import { applyPageCacheHeaders } from "@/lib/page-cache";

// Cloudflare Workers binding injection — `@openstarter/db/server` reads the D1
// (and optional Hyperdrive) binding from `globalThis.__CF_ENV__` (see
// `packages/db/src/runtime.ts::readCloudflareEnv`). On workerd the bindings
// aren't on `process.env`; they arrive via the `cloudflare:workers` module's
// `env` export, stashed here before any request handler runs so the `db()`
// singleton can reach them synchronously.
//
// The module specifier is deliberately kept non-literal so bundlers leave the
// import to runtime. Outside workerd the import rejects and we move on —
// `readCloudflareEnv()` returns undefined, so with the default
// `DATABASE_PROVIDER=d1` the Node process uses the local sqlite file
// (`DATABASE_URL`, default `file:local.db`). Mirrors ShipAny's approach.
const CF_WORKERS_MODULE = "cloudflare:workers";
let cfEnvPromise: Promise<void> | null = null;

function ensureCloudflareEnv(): Promise<void> {
  if (!cfEnvPromise) {
    cfEnvPromise = import(/* @vite-ignore */ CF_WORKERS_MODULE)
      .then((mod) => {
        (globalThis as unknown as { __CF_ENV__?: unknown }).__CF_ENV__ = mod.env;
      })
      .catch(() => {
        // Not running on Cloudflare Workers — nothing to stash.
      });
  }
  return cfEnvPromise;
}

export default {
  async fetch(request: Request): Promise<Response> {
    await ensureCloudflareEnv();
    const response = await paraglideMiddleware(request, () => handler.fetch(request));
    // 静态内容页（营销/博客，含 /zh 前缀变体）的 SSR HTML 无用户态，补共享缓存头
    // （s-maxage + SWR，见 lib/page-cache.ts）；其余路由守卫不满足、响应原样透传。
    // pathname 先经 deLocalizeUrl 归一化（剥 locale 前缀）再匹配策略。
    const canonicalPath = deLocalizeUrl(new URL(request.url)).pathname;
    return applyPageCacheHeaders(canonicalPath, request.method, response);
  },
};
