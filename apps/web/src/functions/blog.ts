import { createInternalRpc } from "@openstarter/api/client";
import { createTtlCache } from "@openstarter/shared/ttl-cache";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  const rpc = await createInternalRpc(INTERNAL_RPC_BASE);
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
  const rpc = await createInternalRpc(INTERNAL_RPC_BASE);
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

const CATEGORY_DELIMITERS = /[,;]/;

export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = parseJsonArray(trimmed);
    if (parsed) {
      return parsed;
    }
  }
  return trimmed
    .split(CATEGORY_DELIMITERS)
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

function parseJsonArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  } catch {
    return null;
  }
}

export function collectCategories(items: ReadonlyArray<{ categories?: string | null }>): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    for (const category of parseCategories(item.categories)) {
      seen.add(category);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export type BlogLocale = "en" | "zh";

export function resolveBlogLocale(locale: string): BlogLocale {
  return locale === "zh" ? "zh" : "en";
}

export function formatBlogDate(dateIso: string, locale: string): string {
  const resolved = resolveBlogLocale(locale);
  return new Intl.DateTimeFormat(resolved === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: resolved === "zh" ? "long" : "short",
    day: "numeric",
  }).format(new Date(dateIso));
}
