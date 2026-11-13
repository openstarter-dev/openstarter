import { hcWithType } from "@openstarter/api/client";
// 必须显式导入 query-core，下面的 declare module 才会被 TS 识别为模块增强。
import type {} from "@tanstack/query-core";

import { getRpcFetchBridge, type RpcFetch } from "@/lib/rpc-bridge";

/**
 * 浏览器：相对 base 走同源请求（`/api/*` 由 `routes/api/$.ts` 转给 Hono）。
 * 服务端：相对 URL 无法 fetch，改由 `src/server.ts` 装入的进程内桥接执行（见 rpc-bridge）。
 * 每次调用时取桥接，避免依赖模块求值顺序。
 */
const rpcFetch: RpcFetch = (input, init) => {
  const bridge = getRpcFetchBridge();
  return bridge ? bridge(input, init) : fetch(input, init);
};

export const client = hcWithType("/", { fetch: rpcFetch });

/**
 * mutation 经 meta 声明的失效目标（meta-invalidation 模式）。
 *
 * 失效规则与 mutation 定义同源：工厂在 `meta: { invalidates }` 声明，QueryClient 的
 * MutationCache.onSuccess 统一消费（见 router.tsx）。组件 onSuccess 只负责 UI 反馈
 * （toast/本地状态）——若在组件里写 invalidateQueries，会被组件自身的 onSuccess 展开
 * 覆盖而静默丢失；集中执行同时消除了逐组件重复。
 *
 * 形态一：静态 QueryKey 数组（覆盖该前缀下全部缓存槽位，列表/详情一并失效）；
 * 形态二：依 variables 计算 key（如详情页 id）。
 */
export type InvalidatesMeta =
  | readonly (readonly unknown[])[]
  | ((variables: never) => readonly (readonly unknown[])[]);

/**
 * 全局 mutation meta 契约：`invalidates` 是唯一被消费的字段。
 * 经 query-core 的 Register 合并进 `MutationMeta`，字段名写错即类型错误，
 * router.tsx 无需再 as 断言。
 */
declare module "@tanstack/query-core" {
  interface Register {
    mutationMeta: { invalidates?: InvalidatesMeta };
  }
}

/** 把 Query 的 AbortSignal 透传给 hono client 的 fetch（路由切换即取消在途请求）。 */
export const withAbort = (signal: AbortSignal) => ({ init: { signal } }) as const;

type Body = { data?: unknown; message?: string };

async function readBody(res: { json: () => Promise<unknown> }): Promise<Body | null> {
  return (await res.json().catch(() => null)) as Body | null;
}

/**
 * 读一次响应 body：非 2xx 透出后端 message（mut-error-handling），缺 data 视为契约违背。
 */
export async function unwrapMutation<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData> {
  const json = (await readBody(res)) as { data?: TData; message?: string } | null;
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  if (json?.data === undefined || json?.data === null) {
    throw new Error(fallbackMessage);
  }
  return json.data;
}

/**
 * 无 data 的写操作（respOk，如 delete）：只校验 HTTP 状态，错误信息同样透出后端 message。
 */
export async function assertOk(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<void> {
  if (res.ok) {
    return;
  }
  const json = await readBody(res);
  throw new Error(json?.message || fallbackMessage);
}

/**
 * 查询侧对称封装：非 2xx 抛错（后端 message 优先，与 unwrapMutation 一致）；
 * `data` 缺失交由调用方兜底（如 permissions 的 `?? []`），不在此收紧为契约错误——
 * 查询面保持「空态可渲染」的原语义，错误面统一透出后端 message。
 *
 * 泛型 TData 必须由调用方从 RPC 响应推导（`InferResponseType<typeof fn, 200>`），
 * 否则 query.data 会退化为 unknown。
 */
export async function unwrapQuery<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData | undefined> {
  const json = await readBody(res);
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  return json?.data as TData | undefined;
}
