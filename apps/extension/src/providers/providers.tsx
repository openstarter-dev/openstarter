import { AuthStateProvider } from "~lib/auth-state";
import { QueryClientProvider } from "~lib/query";
import { ApiClientProvider } from "~lib/api-context";
import { I18nProvider } from "./i18n";
import type { ReactNode } from "react";
import type { createExtensionApiClient } from "~lib/api";
import type { createExtensionAuthClient } from "~lib/auth-client";

type Api = ReturnType<typeof createExtensionApiClient>;
type Auth = ReturnType<typeof createExtensionAuthClient>;

interface AppProvidersProps {
  children: ReactNode;
  value: { api: Api; auth: Auth };
}

export function AppProviders({ children, value }: AppProvidersProps) {
  return (
    <I18nProvider>
      <AuthStateProvider>
        <ApiClientProvider value={value}>
          <QueryClientProvider>
            {children}
          </QueryClientProvider>
        </ApiClientProvider>
      </AuthStateProvider>
    </I18nProvider>
  );
}
