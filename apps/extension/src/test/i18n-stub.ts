import { EXTENSION_DEFAULT_LOCALE, translateMessage } from "@openstarter/i18n-extension";

export const i18n = {
  t: (key: string, ...args: unknown[]): string => {
    const named = args.find(
      (arg): arg is Record<string, string | number> =>
        typeof arg === "object" && arg !== null && !Array.isArray(arg),
    );
    return translateMessage(EXTENSION_DEFAULT_LOCALE, key, named);
  },
};
