// Server-only route: the Hono app (and its whole db/auth chain) must never enter
// the client bundle. TanStack's import-protection rewrites this module to a mock
// in the client environment.
// 纯服务端路由：Hono app（及其 db/auth 依赖链）绝不能进 client bundle——
// TanStack 的 import-protection 会在 client 环境把本模块替换为 mock。
import "@tanstack/react-start/server-only";

import { app } from "@openstarter/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => app.fetch(request),
      POST: ({ request }) => app.fetch(request),
      PUT: ({ request }) => app.fetch(request),
      PATCH: ({ request }) => app.fetch(request),
      DELETE: ({ request }) => app.fetch(request),
    },
  },
});
