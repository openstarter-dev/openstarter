import { createContext, useContext, type ReactNode } from "react";
import type { createExtensionApiClient } from "./api";
import type { createExtensionAuthClient } from "./auth-client";

type Api = ReturnType<typeof createExtensionApiClient>;
type Auth = ReturnType<typeof createExtensionAuthClient>;

interface ApiContextValue {
  api: Api;
  auth: Auth;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiClientProvider({ children, value }: { children: ReactNode; value: ApiContextValue }) {
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiClient() {
  const context = useContext(ApiContext);
  if (!context) throw new Error("useApiClient must be used within ApiClientProvider");
  return context;
}
