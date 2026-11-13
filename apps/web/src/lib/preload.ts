import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

type LoaderFn = NonNullable<AnyRoute["options"]>["loader"];

type PrefetchTarget = { queryKey: readonly unknown[] };

export function preloadQueries<TSearch extends Record<string, unknown> = Record<string, unknown>>(
  factory: (deps: TSearch) => readonly PrefetchTarget[],
): LoaderFn {
  return (async ({ context, deps }: { context: { queryClient: QueryClient }; deps?: TSearch }) => {
    const targets = factory((deps ?? {}) as TSearch);
    if (targets.length === 0) {
      return;
    }
    await Promise.allSettled(
      targets.map((target) => context.queryClient.prefetchQuery(target as never)),
    );
  }) as LoaderFn;
}
