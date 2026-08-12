import { useState } from "react";
import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useSetSignedOut } from "./auth-state";
import type { ReactNode } from "react";

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const setSignedOut = useSetSignedOut();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </TanStackQueryClientProvider>
  );
}
