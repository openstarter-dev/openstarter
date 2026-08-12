import { useEffect, useState } from "react";
import { setLocale } from "../paraglide/runtime.js";
import { getLocale } from "../lib/i18n";
import { getAppUrl } from "../lib/env";
import type { ReactNode } from "react";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const env = getAppUrl();
    const appUrl = env.ok ? env.appUrl : "http://localhost:3000";

    getLocale(appUrl).then((loc) => {
      try {
        setLocale(loc);
      } catch {
        // Paraglide runtime may not be available in test environments
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;

  return <>{children}</>;
}