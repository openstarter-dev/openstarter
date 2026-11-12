// Build TanStack Router head() meta/links arrays from structured page metadata.
// Generates: title, description, locale-aware canonical, hreflang alternates,
// Open Graph, Twitter Card.
//
// SEO 约定（与 sitemap 的 hreflang 声明保持一致，见 lib/seo.ts）：
//  - canonical / og:url 永远指向**当前 locale** 的自指 URL；
//  - 每个受支持 locale 以 rel=alternate hreflang 声明，x-default 指向默认 locale
//    （无前缀）URL —— 否则 /zh/* 页面会因 canonical 指向英文版而被判为重复内容。
//
// 站点基址：显式配置优先（VITE_APP_URL 主名，BETTER_AUTH_URL / URL 为兼容 alias，
// 见 @openstarter/shared/app-url）；浏览器端 process.env.* 编译为 undefined，回退
// window.location.origin —— 客户端不读构建期内联的 VITE_*，否则多域名/预览部署下
// canonical 会指向主域。

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@openstarter/i18n-web";
import { DEFAULT_APP_URL, readConfiguredAppUrl } from "@openstarter/shared/app-url";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";
import { getLocale, localizeUrl } from "@/paraglide/runtime.js";

export interface PageHeadInput {
  title: string;
  description?: string;
  image?: string;
  path: string;
  type?: "website" | "article";
  /** 显式指定 locale（测试/特殊场景）；默认取 Paraglide 当前请求 locale。 */
  locale?: SupportedLocale;
}

export interface PageHead {
  meta: Record<string, string>[];
  links: Record<string, string>[];
}

function getSiteUrl(): string {
  // 服务端（SSR）用显式配置的站点地址；浏览器端 process.env.* 编译为 undefined，
  // 此时回落当前 origin，避免客户端导航时 canonical 指向部署主域。
  const configured = readConfiguredAppUrl();
  if (configured) {
    return configured;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return DEFAULT_APP_URL;
}

function absolutizeUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = getSiteUrl().replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/** 依 locale 生成某路径的绝对 URL（基址 + Paraglide 本地化前缀；base locale 无前缀）。 */
function urlForLocale(path: string, locale: SupportedLocale): string {
  return localizeUrl(absolutizeUrl(path), { locale }).href;
}

// og:locale 使用下划线区域格式（如 en_US）；未登记的 locale 将连字符换为下划线。
const OG_LOCALE_TAGS: Partial<Record<SupportedLocale, string>> = {
  en: "en_US",
  zh: "zh_CN",
};

function ogLocaleTag(locale: SupportedLocale): string {
  return OG_LOCALE_TAGS[locale] ?? locale.replace("-", "_");
}

export function buildPageHead(input: PageHeadInput): PageHead {
  const locale = input.locale ?? getLocale();
  // 品牌名不重复拼接：首页 title 之前会渲染成 "openstarter | openstarter"。
  const fullTitle = input.title === BRAND_NAME ? BRAND_NAME : `${input.title} | ${BRAND_NAME}`;
  const description = input.description ?? BRAND_DESCRIPTION;
  const url = urlForLocale(input.path, locale);
  const image = input.image ? absolutizeUrl(input.image) : undefined;

  const meta: Record<string, string>[] = [
    { title: fullTitle },
    { name: "description", content: description },
    // Open Graph
    { property: "og:site_name", content: BRAND_NAME },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: ogLocaleTag(locale) },
    ...SUPPORTED_LOCALES.filter((loc) => loc !== locale).map((loc) => ({
      property: "og:locale:alternate",
      content: ogLocaleTag(loc),
    })),
    // Twitter Card：无图时降级为 summary，避免声明 large_image 却缺图。
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
  ];

  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }

  const links: Record<string, string>[] = [
    { rel: "canonical", href: url },
    ...SUPPORTED_LOCALES.map((loc) => ({
      rel: "alternate",
      hrefLang: loc,
      href: urlForLocale(input.path, loc),
    })),
    {
      rel: "alternate",
      hrefLang: "x-default",
      href: urlForLocale(input.path, DEFAULT_LOCALE),
    },
  ];

  return { meta, links };
}
