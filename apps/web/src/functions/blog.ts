import type { AppType } from "@openstarter/api";
import { createServerFn } from "@tanstack/react-start";
import { hc } from "hono/client";
import { z } from "zod";

import { createTtlCache } from "@/lib/ttl-cache";
import { localeMiddleware } from "@/middleware/locale";

const INTERNAL_RPC_BASE = "http://blog.internal";

const NOT_FOUND_STATUS = 404;
const BLOG_CACHE_TTL_MS = 60_000;

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

const blogListCache = createTtlCache<Awaited<ReturnType<typeof fetchBlogList>>>({
  maxEntries: 64,
  ttlMs: BLOG_CACHE_TTL_MS,
});
const blogPostCache = createTtlCache<Awaited<ReturnType<typeof fetchBlogPost>>>({
  maxEntries: 128,
  ttlMs: BLOG_CACHE_TTL_MS,
});

export const getBlogPostsFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: unknown) => blogListInput.parse(input))
  .handler(async ({ data, context }) => {
    const cacheKey = JSON.stringify([data.category ?? null, data.page ?? 1, data.pageSize ?? 12]);
    const payload = await blogListCache.wrap(cacheKey, () => fetchBlogList(data));
    return {
      locale: context.locale,
      activeCategory: data.category ?? null,
      items: payload.items,
      total: payload.total,
    };
  });

export const getBlogPostFn = createServerFn({ method: "GET" })
  .middleware([localeMiddleware])
  .validator((input: unknown) => blogSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const post = await blogPostCache.wrap(data.slug, () => fetchBlogPost(data.slug));
    return { locale: context.locale, post };
  });
