import { paraglideMiddleware } from "@openstarter/i18n-web/middleware";
import { deLocalizeUrl } from "@openstarter/i18n-web/runtime";
import handler from "@tanstack/react-start/server-entry";

import { applyPageCacheHeaders } from "@/lib/page-cache";

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
