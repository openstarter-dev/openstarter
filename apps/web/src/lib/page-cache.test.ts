import { describe, expect, it } from "vitest";

import { applyPageCacheHeaders, buildPageCacheControl, pageCachePolicy } from "./page-cache";

function htmlResponse(init?: ResponseInit & { headers?: Record<string, string> }): Response {
  return new Response("<html></html>", {
    headers: { "content-type": "text/html" },
    ...init,
  });
}

describe("pageCachePolicy", () => {
  it.each(["/", "/pricing", "/privacy", "/terms"])("%s → static-page", (pathname) => {
    expect(pageCachePolicy(pathname)).toBe("static-page");
  });

  it("博客列表与详情 → blog-page", () => {
    expect(pageCachePolicy("/blog")).toBe("blog-page");
    expect(pageCachePolicy("/blog/hello-world")).toBe("blog-page");
  });

  it("会话页 / API / 深层未知路径 → null（不可公共缓存）", () => {
    expect(pageCachePolicy("/login")).toBeNull();
    expect(pageCachePolicy("/signup")).toBeNull();
    expect(pageCachePolicy("/dashboard")).toBeNull();
    expect(pageCachePolicy("/blog")).not.toBeNull();
    expect(pageCachePolicy("/blog/a/b")).toBeNull();
    expect(pageCachePolicy("/api/user/orders")).toBeNull();
    expect(pageCachePolicy("/admin/users")).toBeNull();
    expect(pageCachePolicy("/device")).toBeNull();
  });
});

describe("buildPageCacheControl", () => {
  it("静态页与博客页的 s-maxage 不同，浏览器侧一律不缓存", () => {
    expect(buildPageCacheControl("static-page")).toBe(
      "public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(buildPageCacheControl("blog-page")).toBe(
      "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=86400",
    );
  });
});

describe("applyPageCacheHeaders", () => {
  it("静态页 200 HTML → 补 Cache-Control，正文与状态原样保留", async () => {
    const response = applyPageCacheHeaders("/pricing", "GET", htmlResponse());
    expect(response.headers.get("cache-control")).toBe(buildPageCacheControl("static-page"));
    expect(await response.text()).toBe("<html></html>");
    expect(response.status).toBe(200);
  });

  it("博客页拿到 blog-page 策略的 s-maxage", () => {
    const response = applyPageCacheHeaders("/blog/hello", "GET", htmlResponse());
    expect(response.headers.get("cache-control")).toBe(buildPageCacheControl("blog-page"));
  });

  it("非 GET / 非策略路径 / 非 2xx / 非 HTML → 响应原样（无 Cache-Control）", () => {
    expect(applyPageCacheHeaders("/pricing", "POST", htmlResponse()).headers.has("cache-control")).toBe(false);
    expect(applyPageCacheHeaders("/login", "GET", htmlResponse()).headers.has("cache-control")).toBe(false);
    expect(
      applyPageCacheHeaders("/pricing", "GET", htmlResponse({ status: 404 })).headers.has("cache-control"),
    ).toBe(false);
    expect(
      applyPageCacheHeaders("/pricing", "GET", new Response("ok", { headers: { "content-type": "text/plain" } }))
        .headers.has("cache-control"),
    ).toBe(false);
  });

  it("响应已带 Cache-Control（sitemap 等自带头）→ 不覆盖", () => {
    const response = applyPageCacheHeaders(
      "/pricing",
      "GET",
      htmlResponse({ headers: { "cache-control": "public, max-age=600" } }),
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=600");
  });

  it("响应带 Set-Cookie → 绝不加公共缓存头（会话串号防御）", () => {
    const response = applyPageCacheHeaders(
      "/pricing",
      "GET",
      htmlResponse({ headers: { "set-cookie": "session=abc; Path=/" } }),
    );
    expect(response.headers.has("cache-control")).toBe(false);
    expect(response.headers.get("set-cookie")).toBe("session=abc; Path=/");
  });
});
