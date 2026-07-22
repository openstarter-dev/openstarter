// 博客 SSR 数据加载（R16.1 / R16.2 / R16.3）。
//
// 经类型化 RPC（`hc<AppType>`）调用**公开只读**博客端点 `GET /api/blog` 与 `GET /api/blog/:slug`，
// 数据面严格走 apps/web → AppType（RPC）→ packages/api → CMS 服务，不反向依赖、不直接导入服务模块。
//
// SSR 说明：在 server function 内以内存方式将请求分派给已挂载的 Hono `app`（`app.fetch`），
// 避免在 SSR 期解析部署 origin/端口；`app` 仅在服务端 handler 内**动态导入**，不进入客户端产物。
// locale 由 localeMiddleware 依请求解析注入，供组件按当前语言渲染文案（R16.5）。

import type { AppType } from "@openstarter/api";
import { createServerFn } from "@tanstack/react-start";
import { hc } from "hono/client";

import { localeMiddleware } from "@/middleware/locale";

// 内存 RPC 基址：主机名仅用于构造合法 URL，Hono 依 pathname 路由；请求经 `app.fetch` 就地分派。
const INTERNAL_RPC_BASE = "http://blog.internal";

type BlogListInput = {
  category?: string;
  page?: number;
  pageSize?: number;
};

async function createRpc() {
  const { app } = await import("@openstarter/api");
  return hc<AppType>(INTERNAL_RPC_BASE, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

function buildListQuery(input: BlogListInput): {
  category?: string;
  page?: string;
  pageSize?: string;
} {
  const query: { category?: string; page?: string; pageSize?: string } = {};
  if (input.category) {
    query.category = input.category;
  }
  if (input.page !== undefined) {
    query.page = String(input.page);
  }
  if (input.pageSize !== undefined) {
    query.pageSize = String(input.pageSize);
  }
  return query;
}

/** 已发布博客列表：可选按分类精确筛选、分页；随响应回传当前 locale 与激活分类。 */
export const getBlogPostsFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: BlogListInput) => input)
  .handler(async ({ data, context }) => {
    const rpc = await createRpc();
    const res = await rpc.api.blog.$get({ query: buildListQuery(data) });
    const json = res.ok ? await res.json() : undefined;
    const payload = json?.data;
    return {
      locale: context.locale,
      activeCategory: data.category ?? null,
      items: payload?.items ?? [],
      total: payload?.total ?? 0,
    };
  });

/** 单篇已发布博客文章：未发布 / 不存在时 `post` 为 `null`（由路由 loader 转 404）。 */
export const getBlogPostFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const rpc = await createRpc();
    const res = await rpc.api.blog[":slug"].$get({ param: { slug: data.slug } });
    const json = res.ok ? await res.json() : undefined;
    return { locale: context.locale, post: json?.data ?? null };
  });
