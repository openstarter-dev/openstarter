import type { AppType } from "@openstarter/api";
import { baseLocale, locales, localizeUrl } from "@openstarter/i18n-web/runtime";
import { hc } from "hono/client";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";

const INTERNAL_RPC_BASE = "http://seo.internal";

const SITEMAP_STATIC_PATHS = ["", "/pricing", "/blog", "/privacy", "/terms"];

const LLMS_STATIC_PAGES: { path: string; title: string; description: string }[] = [
  { path: "", title: "Home", description: "Landing page" },
  { path: "/pricing", title: "Pricing", description: "Pricing plans" },
  { path: "/blog", title: "Blog", description: "Blog posts and articles" },
];

const ROBOTS_DISALLOW = [
  "/admin",
  "/api/",
  "/dashboard",
  "/device",
  "/forgot-password",
  "/login",
  "/reset-password",
  "/settings",
  "/verify-email",
  "/*?*",
];

export const SEO_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const HOME_PRIORITY = 1;
const STATIC_PAGE_PRIORITY = 0.8;
const ARTICLE_PRIORITY = 0.6;

const XML_ESCAPE_PATTERN = /[&<>"']/g;
const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const WHITESPACE_PATTERN = /\s+/g;

type Locale = (typeof locales)[number];

/** SEO 文章摘要项（经 RPC 取回；时间为 ISO 8601 字符串）。 */
export type SeoArticle = {
  slug: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/** SEO 文章全文项：在摘要基础上附带正文。 */
export type SeoArticleWithContent = SeoArticle & {
  content: string | null;
};

/** 取逗号分隔头部（如经多级代理的 `x-forwarded-*`）的首个值并去空白。 */
function firstToken(value: string): string {
  return (value.split(",").at(0) ?? value).trim();
}

/**
 * 从请求派生站点基址（scheme + host）。优先采用反向代理转发头（`x-forwarded-proto` /
 * `x-forwarded-host`），回退到请求 URL 自身的 origin；末尾不含斜杠。
 */
export function getSiteOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = firstToken(forwardedProto ?? url.protocol.replace(":", ""));
  const host = firstToken(forwardedHost ?? url.host);
  return `${proto}://${host}`;
}

function escapeXml(value: string): string {
  return value.replace(XML_ESCAPE_PATTERN, (char) => XML_ESCAPES[char] ?? char);
}

function singleLine(value: string): string {
  return value.replace(WHITESPACE_PATTERN, " ").trim();
}

/** 依 locale 生成某路径的绝对 URL（基址 + 本地化路径）。base locale 无前缀、其余带 `/{locale}` 前缀。 */
function urlForLocale(origin: string, path: string, locale: Locale): string {
  return localizeUrl(`${origin}${path || "/"}`, { locale }).href;
}

async function createRpc() {
  const { app } = await import("@openstarter/api");
  return hc<AppType>(INTERNAL_RPC_BASE, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

/** 取已发布文章摘要（仅已发布）；失败时回退空列表以保证端点始终可用。 */
export async function fetchSeoArticles(): Promise<SeoArticle[]> {
  try {
    const rpc = await createRpc();
    const res = await rpc.api.seo.articles.$get();
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

/** 取已发布文章全文（仅已发布）；失败时回退空列表。 */
export async function fetchSeoArticlesWithContent(): Promise<SeoArticleWithContent[]> {
  try {
    const rpc = await createRpc();
    const res = await rpc.api.seo.articles.full.$get();
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

type SitemapEntry = {
  path: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
};

function sitemapEntryXml(origin: string, entry: SitemapEntry): string {
  const alternates = locales
    .map(
      (loc) =>
        `    <xhtml:link rel="alternate" hreflang="${loc}" href="${escapeXml(
          urlForLocale(origin, entry.path, loc),
        )}"/>`,
    )
    .join("\n");
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(urlForLocale(origin, entry.path, baseLocale))}</loc>`,
    alternates,
  ];
  if (entry.lastModified) {
    lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
  }
  lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
  lines.push(`    <priority>${entry.priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

/**
 * 渲染 sitemap.xml：公开页面 + **已发布**文章 URL。
 *
 * locale 感知：`<loc>` 为 base locale 的**规范 URL**（无本地化前缀），各语言版本以
 * `xhtml:link rel="alternate" hreflang` 声明，避免重复本地化前缀导致重复内容。
 */
export function buildSitemapXml(origin: string, articles: SeoArticle[]): string {
  const staticEntries: SitemapEntry[] = SITEMAP_STATIC_PATHS.map((path) => ({
    path,
    changeFrequency: path === "/blog" ? "daily" : "weekly",
    priority: path === "" ? HOME_PRIORITY : STATIC_PAGE_PRIORITY,
  }));
  const articleEntries: SitemapEntry[] = articles.map((article) => ({
    path: `/blog/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly",
    priority: ARTICLE_PRIORITY,
  }));
  const entries = [...staticEntries, ...articleEntries];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map((entry) => sitemapEntryXml(origin, entry)),
    "</urlset>",
    "",
  ].join("\n");
}

/** 渲染 robots.txt：屏蔽鉴权/私有区与 API，并声明 sitemap 地址。 */
export function buildRobotsTxt(origin: string): string {
  return [
    "User-Agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

function llmsHeaderLines(): string[] {
  return [
    `# ${singleLine(BRAND_NAME)}`,
    "",
    `> ${singleLine(BRAND_DESCRIPTION)}`,
    "",
    "## Pages",
    "",
  ];
}

/** 渲染 llms.txt：站点概览 + 公开页面与已发布文章的可读清单（规范 URL、无正文）。 */
export function buildLlmsTxt(origin: string, articles: SeoArticle[]): string {
  const lines: string[] = [
    ...llmsHeaderLines(),
    ...LLMS_STATIC_PAGES.map(
      (page) =>
        `- [${singleLine(page.title)}](${origin}${page.path}): ${singleLine(page.description)}`,
    ),
  ];
  if (articles.length > 0) {
    lines.push("", "## Blog Posts", "");
    for (const article of articles) {
      const title = singleLine(article.title ?? article.slug);
      const description = singleLine(article.description ?? "");
      lines.push(`- [${title}](${origin}/blog/${article.slug}): ${description}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/** 渲染 llms-full.txt：站点概览 + 已发布文章全文（含正文），供大模型抓取。 */
export function buildLlmsFullTxt(origin: string, articles: SeoArticleWithContent[]): string {
  const lines: string[] = [
    ...llmsHeaderLines(),
    ...LLMS_STATIC_PAGES.map(
      (page) =>
        `- [${singleLine(page.title)}](${origin}${page.path}): ${singleLine(page.description)}`,
    ),
  ];
  if (articles.length > 0) {
    lines.push("", "## Blog Posts", "");
    for (const article of articles) {
      lines.push(`### ${singleLine(article.title ?? article.slug)}`, "");
      lines.push(`URL: ${origin}/blog/${article.slug}`);
      if (article.description) {
        lines.push(`Description: ${singleLine(article.description)}`);
      }
      lines.push("");
      if (article.content) {
        lines.push(article.content, "");
      }
      lines.push("---", "");
    }
  }
  lines.push("");
  return lines.join("\n");
}
