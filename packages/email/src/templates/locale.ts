// 邮件模板本地化：将任意 locale 字符串收敛为模板支持的语言（en/zh）。
// 与 @openstarter/i18n 的受支持语言集合（en/zh，默认 en）保持一致，
// 但本文件零外部依赖，避免让 @openstarter/email 根导出被 i18n 运行时耦合。
// Requirements: 22.5、22.6。

// 模板文案支持的语言集合；未匹配时回落 en（与 i18n 默认语言一致）。
export type EmailLocale = "en" | "zh";

/**
 * 将任意语言标签收敛为模板支持的 locale。
 *
 * 兼容区域标签（如 `zh-CN`/`en-US`，大小写无关），仅按主语言判定：
 * 以 `zh` 开头者取 `zh`，其余一律回落 `en`。
 *
 * @param locale 调用方传入的语言标签（通常来自 getLocaleFromRequest）。
 * @returns 模板可用的 `en` 或 `zh`。
 */
export const resolveEmailLocale = (locale: string): EmailLocale => {
  const [base] = locale.trim().toLowerCase().split("-");
  return base === "zh" ? "zh" : "en";
};
