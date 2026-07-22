// @openstarter/i18n 包入口 —— 根导出翻译键类型与受支持语言集合。
// 供 packages/auth/src/types.ts 将认证错误码映射到翻译键（并归一其遗留的 @workspace/i18n 引用），
// 以及 apps/web / packages/email 等按同一 locale 集合与默认语言保持一致。
// 位于 auth 依赖层之下，不依赖 packages/api、packages/auth。
// Requirements: 23.1、23.5、23.6。

// 受支持的界面语言集合（en/zh，R23.1）。消息文件（messages/{locale}.json）与
// project.inlang/settings.json 的 locales 与此保持一致；apps/web 的 Paraglide 运行时据此编译。
export const SUPPORTED_LOCALES = ["en", "zh"] as const;

// 受支持 locale 的字面量联合类型。
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// 基准/兜底默认语言（对应 project.inlang 的 baseLocale）。运行时可由 VITE_DEFAULT_LOCALE
// 覆盖（见 @openstarter/i18n/server 的 getLocaleFromRequest），此常量为无配置时的回落值。
export const DEFAULT_LOCALE: SupportedLocale = "en";

// 翻译键类型：en/zh 消息文件覆盖相同键集合（R23.5）。此处以 string 承载，
// 供 auth 的错误码→翻译键映射按字符串键消费，不与具体消息键联合类型强耦合。
export type TranslationKey = string;
