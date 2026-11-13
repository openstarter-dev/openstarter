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
