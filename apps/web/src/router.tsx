import { m } from "@openstarter/i18n-web/messages";
import { deLocalizeUrl, localizeUrl } from "@openstarter/i18n-web/runtime";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { toast } from "sonner";

import Loader from "./components/loader";
import { ErrorPage } from "./components/system/error";
import { NotFound } from "./components/system/not-found";
import { routeTree } from "./routeTree.gen";

function createQueryClient() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.state.data !== undefined) {
          return;
        }
        if (query.getObserversCount() === 0) {
          return;
        }
        const message = import.meta.env.DEV ? error.message : m["common.error.message"]();
        toast.error(message, {
          action: {
            label: m["common.error.retry"](),
            onClick: () => {
              void query.invalidate();
            },
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = error.message || m["common.error.message"]();
        toast.error(message);
      },
      onSuccess: (_data, variables, _context, mutation) => {
        const invalidates = mutation.meta?.invalidates;
        if (!invalidates) {
          return;
        }
        const keys =
          typeof invalidates === "function" ? invalidates(variables as never) : invalidates;
        for (const key of keys) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = (error as { status?: unknown }).status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 1;
        },
        retryDelay: 500,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
  return queryClient;
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    defaultPendingComponent: () => <Loader />,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: ({ error }) => <ErrorPage error={error} />,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
