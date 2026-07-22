// 博客日期本地化（R16.5）。
//
// 全站界面文案已由 Paraglide 运行时（apps/web/src/paraglide，消息定义在 packages/i18n）承载：
// 博客文案统一以 m["blog.*"]() 解析（见 routes/blog/*），不再走本地文案字典。此处仅保留与
// 翻译键无关的「按当前 locale 本地化文章日期」纯函数，供列表页/详情页复用。

// 受支持界面语言（与 @openstarter/i18n 的 SUPPORTED_LOCALES 对齐）。
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
