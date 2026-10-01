// @openstarter/i18n-extension —— 浏览器插件端专用的精简消息目录与运行时工具。
// 与 packages/i18n/web（Web 端，inlang/Paraglide）相互独立：插件端采用 @wxt-dev/i18n
// （browser.i18n 封装），locales/{locale}.json 由 wxt.config.ts 的 i18n.localesDir 直接
// 指向本目录，构建时编译为扩展的 _locales/<locale>/messages.json；本目录另提供同一份
// 目录的 TS 消费形态（扁平键 + {name} 替换），供 vitest stub 与非扩展环境复用。
// 语言跟随浏览器 UI 语言（browser.i18n 不支持运行时切换），不读 web 端 locale cookie。
// 位于 auth 依赖层之下，不依赖 packages/api、packages/auth，也不依赖 packages/i18n/web
// （turbo boundary：platform:extension 不引用 platform:web）。

import enJson from "../locales/en.json";
import zhCnJson from "../locales/zh_CN.json";

// 受支持语言集合与默认语言（与 locales/ 文件名一一对应；default 需与
// wxt.config.ts 的 manifest.default_locale 一致）。
export const EXTENSION_LOCALES = ["en", "zh_CN"] as const;

export type ExtensionLocale = (typeof EXTENSION_LOCALES)[number];

export const EXTENSION_DEFAULT_LOCALE: ExtensionLocale = "en";

// 嵌套 JSON 扁平化为 "a.b.c" 点路径键，值中的 {name} 为命名占位符。
export function flattenCatalog(catalog: unknown, prefix = ""): Record<string, string> {
  const entries = Object.entries(catalog as Record<string, unknown>);
  return entries.reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      return { ...acc, [path]: value };
    }
    return { ...acc, ...flattenCatalog(value, path) };
  }, {});
}

// 目录的扁平形态：{ locale: Record<"a.b", string> }。en 为键类型基准
// （structure 类型由 @wxt-dev/i18n 从 en 生成，二者保持一致）。
export const EXTENSION_MESSAGES: Record<ExtensionLocale, Record<string, string>> = {
  en: flattenCatalog(enJson),
  zh_CN: flattenCatalog(zhCnJson),
};

// {name} 占位符替换；未提供的占位符保留原样。
function applyNamedSubstitutions(message: string, named?: Record<string, string | number>): string {
  if (!named) {
    return message;
  }
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(named, key) ? String(named[key]) : match,
  );
}

// 按语言取译文；locale 或键缺失时回落默认语言，仍缺失则返回键本身。
export function translateMessage(
  locale: string,
  key: string,
  named?: Record<string, string | number>,
): string {
  const normalizedLocale = locale === "zh" || locale === "zh-CN" ? "zh_CN" : locale;
  const catalog =
    EXTENSION_MESSAGES[normalizedLocale as ExtensionLocale] ??
    EXTENSION_MESSAGES[EXTENSION_DEFAULT_LOCALE];
  const message = catalog[key] ?? EXTENSION_MESSAGES[EXTENSION_DEFAULT_LOCALE][key];
  return applyNamedSubstitutions(message ?? key, named);
}
