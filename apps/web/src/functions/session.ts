// apps/web/src/functions/session.ts
// 服务端会话读取（SSR 专用）。
//
// 为什么需要它：`authClient.getSession()` 走浏览器 fetch，相对 URL + Cookie 缺一不可。
// 而路由 `beforeLoad` 在 SSR 期间也会执行——Node 侧既无法解析相对 URL，也没有当前请求的
// Cookie，结果必然是「未登录」。这里改用 createServerFn 在当前请求内直连 better-auth，
// 把请求头（含 Cookie）原样转发。
//
// 返回值刻意对齐 better-auth 浏览器客户端的 `{ data, error }` 形状，使 `_app` 路由上下文
// 在 SSR / CSR 两条路径下可互换消费（见 routes/_app/route.tsx、routes/_app/dashboard.tsx）。

import { createServerFn } from "@tanstack/react-start";

export const getServerSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("@openstarter/auth/server"),
    import("@tanstack/react-start/server"),
  ]);

  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  return { data: session, error: null };
});
