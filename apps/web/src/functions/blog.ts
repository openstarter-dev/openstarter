// 博客 SSR 数据加载（R16.1 / R16.2 / R16.3）。
//
// 经类型化 RPC（`hc<AppType>`）调用**公开只读**博客端点 `GET /api/blog` 与 `GET /api/blog/:slug`，
// 数据面严格走 apps/web → AppType（RPC）→ packages/api → CMS 服务，不反向依赖、不直接导入服务模块。
//
// SSR 说明：在 server function 内以内存方式将请求分派给已挂载的 Hono `app`（`app.fetch`），
// 避免在 SSR 期解析部署 origin/端口；`app` 仅在服务端 handler 内**动态导入**，不进入客户端产物。
// locale 由 localeMiddleware 依请求解析注入，供组件按当前语言渲染文案（R16.5）。
//
// 缓存（进程内 60s TTL，lib/ttl-cache.ts）：已发布文章是低频变更内容，此前每个文档
// 请求都回源打 DB。CDN 层的 s-maxage（lib/page-cache.ts）过期回源后仍有本层兜底；
// 新发布/下架文章最迟 TTL 后可见。locale 不入缓存 key——数据载荷与 locale 无关
// （文案渲染在组件层），locale 由请求上下文即时拼回，中英请求共享同一份数据缓存。
//
// 错误语义（sf-error-handling / sf-input-validation）：
// - 输入经 zod 校验（GET server fn 的数据以字符串形态过 wire，故数值用 coerce）；
// - 真实故障（5xx / 网络失败 / 信封缺 data）抛出，由路由 error boundary 呈现——
//   不再 `?? []` 吞成「暂无文章」，后端挂掉伪装成空博客比报错更糟；
// - 唯一合法的「空」是详情页 404（文章不存在/未发布），返回 `post: null` 交由路由转 notFound()。

import type { AppType } from "@openstarter/api";
import { createServerFn } from "@tanstack/react-start";
import { hc } from "hono/client";
import { z } from "zod";

import { createTtlCache } from "@/lib/ttl-cache";
import { localeMiddleware } from "@/middleware/locale";

// 内存 RPC 基址：主机名仅用于构造合法 URL，Hono 依 pathname 路由；请求经 `app.fetch` 就地分派。
const INTERNAL_RPC_BASE = "http://blog.internal";

const NOT_FOUND_STATUS = 404;
const BLOG_CACHE_TTL_MS = 60_000;

// 与后端 listQuery（createPaginationSchema(100, 12).extend({category})）对齐的入参约束。
const blogListInput = z.object({
  category: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const blogSlugInput = z.object({
  slug: z.string().min(1).max(200),
});

async function createRpc() {
  const { app } = await import("@openstarter/api");
  return hc<AppType>(INTERNAL_RPC_BASE, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

function buildListQuery(input: z.infer<typeof blogListInput>): {
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

/** 回源拉取已发布文章列表（不含 locale——locale 由 handler 拼回，不进缓存）。 */
async function fetchBlogList(input: z.infer<typeof blogListInput>) {
  const rpc = await createRpc();
  const res = await rpc.api.blog.$get({ query: buildListQuery(input) });
  if (!res.ok) {
    throw new Error(`Blog list request failed (HTTP ${res.status})`);
  }
  const json = await res.json();
  const payload = json.data;
  if (!payload) {
    throw new Error("Blog list response missing data");
  }
  return { items: payload.items, total: payload.total };
}

/** 回源拉取单篇文章；不存在/未发布返回 null（404 业务语义）。 */
async function fetchBlogPost(slug: string) {
  const rpc = await createRpc();
  const res = await rpc.api.blog[":slug"].$get({ param: { slug } });
  if (res.status === NOT_FOUND_STATUS) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Blog post request failed (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!json.data) {
    throw new Error("Blog post response missing data");
  }
  return json.data;
}

// 404（null）同样缓存：slug 扫描与不存在文章的重复回源都应被挡住。容量上限防穷举撑爆内存。
const blogListCache = createTtlCache<Awaited<ReturnType<typeof fetchBlogList>>>({
  maxEntries: 64,
  ttlMs: BLOG_CACHE_TTL_MS,
});
const blogPostCache = createTtlCache<Awaited<ReturnType<typeof fetchBlogPost>>>({
  maxEntries: 128,
  ttlMs: BLOG_CACHE_TTL_MS,
});

/** 已发布博客列表：可选按分类精确筛选、分页；随响应回传当前 locale 与激活分类。 */
export const getBlogPostsFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: unknown) => blogListInput.parse(input))
  .handler(async ({ data, context }) => {
    // key 与后端 listQuery 默认值（page=1 / pageSize=12）对齐，避免同一数据多 key。
    const cacheKey = JSON.stringify([data.category ?? null, data.page ?? 1, data.pageSize ?? 12]);
    const payload = await blogListCache.wrap(cacheKey, () => fetchBlogList(data));
    return {
      locale: context.locale,
      activeCategory: data.category ?? null,
      items: payload.items,
      total: payload.total,
    };
  });

/** 单篇已发布博客文章：未发布 / 不存在时 `post` 为 `null`（由路由 loader 转 404）。 */
export const getBlogPostFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: unknown) => blogSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const post = await blogPostCache.wrap(data.slug, () => fetchBlogPost(data.slug));
    return { locale: context.locale, post };
  });
