// apps/extension/src/lib/i18n.ts —— Locale detection for the extension.
// Fallback chain: cookie → browser.i18n.getUILanguage() → DEFAULT_LOCALE.
import { DEFAULT_LOCALE } from "@openstarter/i18n";

const COOKIE_NAME = "openstarter.locale";

/**
 * Get the current locale for the extension popup.
 *
 * Priority:
 * 1. Cookie 'openstarter.locale' (set by setLocale() from the web app)
 * 2. browser.i18n.getUILanguage() (browser's UI language)
 * 3. DEFAULT_LOCALE (from @openstarter/i18n, typically "en")
 */
export async function getLocale(appUrl: string): Promise<string> {
  try {
    // Dynamic import to avoid issues in test environments
    const { browser } = await import("wxt/browser");

    const cookieLang = await browser.cookies.get({
      url: appUrl,
      name: COOKIE_NAME,
    });

    if (cookieLang?.value) {
      return cookieLang.value;
    }

    const browserLang = browser.i18n.getUILanguage();
    if (browserLang) {
      return browserLang;
    }
  } catch {
    // Fall through to default
  }

  return DEFAULT_LOCALE;
}
