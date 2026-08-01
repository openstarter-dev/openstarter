// apps/mobile/src/lib/locale.ts —— 决定启动时用哪个语言。
//
// Web 端 Paraglide 走 url / cookie 策略，两者都是浏览器专属；原生端改为
// globalVariable + baseLocale，由应用自己解析并显式 setLocale（见 spec §6 国际化）。
//
// 优先级：用户显式选择（持久化） > 设备语言 > DEFAULT_LOCALE。
// 设备语言按主语言子标签匹配：zh-Hans-CN / ZH-CN 都应命中 "zh"。
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@openstarter/i18n";

export function isSupportedLocale(
  value: string | null | undefined
): value is SupportedLocale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveInitialLocale(
  deviceLocales: readonly string[],
  persisted: string | null
): SupportedLocale {
  if (isSupportedLocale(persisted)) {
    return persisted;
  }

  for (const tag of deviceLocales) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (isSupportedLocale(primary)) {
      return primary;
    }
  }

  return DEFAULT_LOCALE;
}
