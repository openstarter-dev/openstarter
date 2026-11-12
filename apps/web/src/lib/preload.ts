import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

type LoaderFn = NonNullable<AnyRoute["options"]>["loader"];

/**
 * 预取目标的最小结构。用结构类型而不是 `QueryOptions`：后者的 queryFn 对
 * queryKey 协变，`queryOptions()` 的具体 key 元组无法赋给默认泛型参数。
 */
type PrefetchTarget = { queryKey: readonly unknown[] };

/**
 * 返回一个可用作路由 `loader` 的函数：按 loaderDeps 透传的 URL 参数并行预取一组 query。
 *
 * `TSearch` 由调用方给出（通常是该路由 `validateSearch` 的输出类型），
 * 这样 deps 字段写错或 query 参数类型不匹配时会在编译期报错，而不是静默预取第一页。
 *
 * @param factory 接收 loaderDeps（通常是整份 search 的透传），返回要预取的
 *                queryOptions 列表；返回空数组则跳过（不发请求）。
 */
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
