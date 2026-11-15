import { app } from "@openstarter/api";
import { paraglideMiddleware } from "@openstarter/i18n-web/middleware";
import { deLocalizeUrl } from "@openstarter/i18n-web/runtime";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { applyPageCacheHeaders } from "@/lib/page-cache";
import { setRpcFetchBridge } from "@/lib/rpc-bridge";

const INTERNAL_RPC_ORIGIN = "http://web.internal";

setRpcFetchBridge(async (input, init) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  const headers = new Headers(getRequestHeaders());
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

  return app.fetch(new Request(new URL(raw, INTERNAL_RPC_ORIGIN), { ...init, headers }));
});

export default createServerEntry({
  async fetch(request, opts) {
    const response = await paraglideMiddleware(request, () => handler.fetch(request, opts));
    const canonicalPath = deLocalizeUrl(new URL(request.url)).pathname;
    return applyPageCacheHeaders(canonicalPath, request.method, response);
  },
});
