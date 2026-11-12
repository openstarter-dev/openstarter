import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@openstarter/i18n-web";
import { getLocale, localizeUrl } from "@openstarter/i18n-web/runtime";
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";

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
  const configured = typeof process === "undefined" ? undefined : process.env.VITE_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
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

const OG_LOCALE_TAGS: Partial<Record<SupportedLocale, string>> = {
  en: "en_US",
  zh: "zh_CN",
};

function ogLocaleTag(locale: SupportedLocale): string {
  return OG_LOCALE_TAGS[locale] ?? locale.replace("-", "_");
}

export function buildPageHead(input: PageHeadInput): PageHead {
  const locale = input.locale ?? getLocale();
  const fullTitle = input.title === BRAND_NAME ? BRAND_NAME : `${input.title} | ${BRAND_NAME}`;
  const description = input.description ?? BRAND_DESCRIPTION;
  const url = urlForLocale(input.path, locale);
  const image = input.image ? absolutizeUrl(input.image) : undefined;

  const meta: Record<string, string>[] = [
    { title: fullTitle },
    { name: "description", content: description },
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
