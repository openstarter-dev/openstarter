import { useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useSetSignedOut } from "./auth-state";
import type { ReactNode } from "react";

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const setSignedOut = useSetSignedOut();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Transition to signed-out UI on 401 instead of rendering generic error state
        // 遇到 401 未授权错误时切换至未登录视图，而非展示通用错误页
        queryCache: new QueryCache({
          onError: (error) => {
            if ((error as { status?: unknown }).status === 401) {
              setSignedOut();
            }
          },
        }),
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
