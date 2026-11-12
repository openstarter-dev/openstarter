// 静态内容页的共享缓存（CDN）策略。
//
// 营销页与博客页的 SSR HTML 不含用户态——页头的会话 CTA（AuthCta）是客户端
// hook 渲染（SSR 输出 Skeleton），其余内容为静态常量/公开数据——同一 URL 对
// 登录/匿名用户输出完全一致的 HTML，因此可安全交给共享缓存（s-maxage +
// stale-while-revalidate）。含会话的 App/认证/admin 页与 API 一律不加（策略
// 返回 null）。
//
// applyPageCacheHeaders 的守卫（任一不满足则响应原样返回）：
//   - 仅 GET、仅 2xx、仅 text/html；
//   - 响应带 Set-Cookie 时绝不公共缓存（会话串号风险）；
//   - 响应已带 Cache-Control 时不覆盖（sitemap/robots/llms.txt 等自带头）。
// 浏览器侧始终 max-age=0 + must-revalidate：s-maxage 只影响共享缓存，用户
// 拿到的永远是可验证的新 HTML。
//
// pathname 一律传「已去 locale 前缀」的规范路径（调用方用 paraglide 的
// deLocalizeUrl 归一化），本模块因此不依赖 paraglide 编译产物、可独立测试。

export type PageCachePolicy = "static-page" | "blog-page";

// 静态营销页内容为编译期常量，可缓存较久；博客内容来自 DB（server fn 层另有
// 60s TTL 缓存兜底，见 functions/blog.ts），s-maxage 取 5 分钟平衡新鲜度与回源量。
const STATIC_PAGE_S_MAXAGE = 3600;
const BLOG_PAGE_S_MAXAGE = 300;
const STALE_WHILE_REVALIDATE = 86_400;

const STATIC_PATHS = new Set(["/", "/pricing", "/privacy", "/terms"]);
// /blog 或 /blog/:slug；更深的路径（/blog/a/b）不属于任何路由，不缓存。
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
  // Response 的 headers guard 跨运行时不保证可变，重建响应确保 Node/workerd 行为一致。
  return new Response(response.body, {
    headers: withCache,
    status: response.status,
    statusText: response.statusText,
  });
}
