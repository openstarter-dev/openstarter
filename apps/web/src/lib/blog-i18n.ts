export type BlogLocale = "en" | "zh";

/** 将任意 locale 字符串收敛为受支持的 {@link BlogLocale}（默认 en）。 */
export function resolveBlogLocale(locale: string): BlogLocale {
  return locale === "zh" ? "zh" : "en";
}

/** 依当前 locale 本地化文章日期（接受 ISO 字符串）。 */
export function formatBlogDate(dateIso: string, locale: string): string {
  const resolved = resolveBlogLocale(locale);
  return new Intl.DateTimeFormat(resolved === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: resolved === "zh" ? "long" : "short",
    day: "numeric",
  }).format(new Date(dateIso));
}
