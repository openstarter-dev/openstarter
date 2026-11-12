import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

type LoaderFn = NonNullable<AnyRoute["options"]>["loader"];

/**
 * 返回一个可用作路由 `loader` 的函数：按 loaderDeps 透传的 URL 参数并行预取一组 query。
 *
 * @param factory 接收 loaderDeps（通常是整份 search 的透传），返回要预取的
 *                queryOptions 列表；返回空数组则跳过（不发请求）。
 */
export function preloadQueries(
  factory: (deps: Record<string, unknown>) => readonly unknown[],
): LoaderFn {
  return (async ({
    context,
    deps,
  }: {
    context: { queryClient: QueryClient };
    deps?: Record<string, unknown>;
  }) => {
    const targets = factory(deps ?? {});
    if (targets.length === 0) {
      return;
    }
    await Promise.allSettled(
      targets.map((target) => context.queryClient.prefetchQuery(target as never)),
    );
  }) as LoaderFn;
}
