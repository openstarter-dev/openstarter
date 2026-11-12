export type PageCachePolicy = "static-page" | "blog-page";

const STATIC_PAGE_S_MAXAGE = 3600;
const BLOG_PAGE_S_MAXAGE = 300;
const STALE_WHILE_REVALIDATE = 86_400;

const STATIC_PATHS = new Set(["/", "/pricing", "/privacy", "/terms"]);
const BLOG_PATH_PATTERN = /^\/blog(?:\/[^/]+)?$/;

/** 规范（去 locale 前缀）路径 → 缓存策略；null 表示不可公共缓存。 */
export function pageCachePolicy(pathname: string): PageCachePolicy | null {
  if (STATIC_PATHS.has(pathname)) {
    return "static-page";
  }
  return BLOG_PATH_PATTERN.test(pathname) ? "blog-page" : null;
}

export function buildPageCacheControl(policy: PageCachePolicy): string {
  const sMaxage = policy === "static-page" ? STATIC_PAGE_S_MAXAGE : BLOG_PAGE_S_MAXAGE;
  return `public, max-age=0, must-revalidate, s-maxage=${sMaxage}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`;
}

/**
 * 依策略为 SSR HTML 响应补 Cache-Control。
 *
 * @param pathname 已去 locale 前缀的规范路径（如 "/pricing"，而非 "/zh/pricing"）
 * @param method   请求方法
 * @param response 框架产出的原始响应
 */
export function applyPageCacheHeaders(pathname: string, method: string, response: Response): Response {
  const policy = pageCachePolicy(pathname);
  if (!policy || method !== "GET") {
    return response;
  }
  if (response.status < 200 || response.status >= 300) {
    return response;
  }
  const headers = response.headers;
  if (headers.has("cache-control") || headers.has("set-cookie")) {
    return response;
  }
  const contentType = headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }
  const withCache = new Headers(headers);
  withCache.set("cache-control", buildPageCacheControl(policy));
  return new Response(response.body, {
    headers: withCache,
    status: response.status,
    statusText: response.statusText,
  });
}
