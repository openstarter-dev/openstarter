import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@openstarter/i18n-mobile";

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveInitialLocale(
  deviceLocales: readonly string[],
  persisted: string | null,
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
