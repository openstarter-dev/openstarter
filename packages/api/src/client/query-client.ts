import { MutationCache, QueryCache, QueryClient } from "@tanstack/query-core";
import type { Query } from "@tanstack/query-core";

/** mutation 成功后需要失效的 query key，通过 `meta: { invalidates: [...] }` 声明。 */
export type InvalidatesMeta =
  | readonly (readonly unknown[])[]
  | ((variables: never) => readonly (readonly unknown[])[]);

declare module "@tanstack/query-core" {
  interface Register {
    mutationMeta: { invalidates?: InvalidatesMeta };
  }
}

export interface CreateQueryClientOptions {
  /** 默认 60s，与 web 现有行为一致。 */
  staleTimeMs?: number;
  retry?: (failureCount: number, error: Error) => boolean;
  retryDelayMs?: number;
  refetchOnWindowFocus?: boolean;
  onQueryError?: (error: Error, query: Query<unknown, unknown>) => void;
  onMutationError?: (error: Error) => void;
}

const DEFAULT_STALE_TIME_MS = 60_000;
const DEFAULT_RETRY_DELAY_MS = 500;

function defaultRetry(failureCount: number, error: Error): boolean {
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return false;
  }
  return failureCount < 1;
}

/**
 * 多端统一的 QueryClient 默认值；提示文案等平台差异通过回调注入。
 * `meta.invalidates` 的自动失效也在这里统一处理。
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  const {
    staleTimeMs = DEFAULT_STALE_TIME_MS,
    retry = defaultRetry,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    refetchOnWindowFocus = false,
    onQueryError,
    onMutationError,
  } = options;

  const queryClient: QueryClient = new QueryClient({
    ...(onQueryError ? { queryCache: new QueryCache({ onError: onQueryError }) } : {}),
    mutationCache: new MutationCache({
      onError: (error) => onMutationError?.(error),
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
        refetchOnWindowFocus,
        retry,
        retryDelay: retryDelayMs,
        staleTime: staleTimeMs,
      },
    },
  });

  return queryClient;
}
