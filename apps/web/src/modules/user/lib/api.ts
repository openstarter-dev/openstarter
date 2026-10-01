// Query 工厂：user settings 模块（R8/R11/R13/R27）
// 数据面经类型化 RPC（`client.api.*`）→ packages/api（requireAuth）。
//
// queryKey 约定：`["user", <资源>, ...参数]` 分层组织（qk-hierarchical-organization）。
// userKeys 同时被 tickets 等相邻模块引用，失效时按前缀命中，避免手写 key 漂移。

import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client } from "@/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

/** 创建 API key 的响应 data（含一次性展示的明文 key），从 RPC 响应推导。 */
type ApiKeyRow = NonNullable<InferResponseType<typeof client.api.apikeys.$post, 200>["data"]>;

/** 用户积分流水行（积分历史列表），从 user.credits 响应推导。 */
export type CreditHistoryRow = NonNullable<
  InferResponseType<typeof client.api.user.credits.$get, 200>["data"]
>["history"][number];

const PAGE_SIZE = LIST_PAGE_SIZE;

/** user 域 query key 工厂（分层前缀，失效可粗可细；tickets 等相邻模块共用）。 */
export const userKeys = {
  all: ["user"] as const,
  apiKeys: () => ["user", "apikeys"] as const,
  credits: () => ["user", "credits"] as const,
  orders: (page: number) => ["user", "orders", page] as const,
  permissions: () => ["user", "permissions"] as const,
  plan: () => ["user", "plan"] as const,
  subscription: () => ["user", "subscription"] as const,
  tickets: {
    // null 详情 id 保留为 key 的第三段（["user","tickets",null]），与列表 key
    // （["user","tickets"]，两段）区分开——未选中时详情查询以 enabled:false 挂着，
    // 绝不能与列表共享缓存槽位。
    all: ["user", "tickets"] as const,
    detail: (id: string | null) => ["user", "tickets", id] as const,
  },
};

const queries = {
  apiKeys: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.apikeys.$get({ query: {} });
        if (!res.ok) {
          throw new Error("Failed to load API keys");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.apiKeys(),
    }),
  credits: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user.credits.$get({ query: {} });
        if (!res.ok) {
          throw new Error("Failed to load credits");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.credits(),
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user.orders.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load payments");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.orders(page),
      // 翻页保留上一页数据（分页列表统一行为，见各消费页）。
      placeholderData: keepPreviousData,
    }),
  plan: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user.plan.$get();
        if (!res.ok) {
          throw new Error("Failed to load plan");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.plan(),
    }),
  // 当前用户权限码集合：admin 布局守卫（beforeLoad ensureQueryData）消费。
  // staleTime 放宽——角色变更后刷新页面/重新登录才会重取，会话内导航零请求。
  permissions: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user.permissions.$get();
        if (!res.ok) {
          throw new Error("Failed to load permissions");
        }
        const json = await res.json();
        return json.data ?? [];
      },
      queryKey: userKeys.permissions(),
      staleTime: 5 * 60 * 1000,
    }),
  subscription: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user.subscription.$get();
        if (!res.ok) {
          throw new Error("Failed to load subscription");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.subscription(),
    }),
};

/** 读一次响应 body：非 2xx 透出后端 message（mut-error-handling），缺 data 视为契约违背。 */
async function unwrapMutation<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData> {
  const json = (await res.json().catch(() => null)) as {
    data?: TData;
    message?: string;
  } | null;
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  if (json?.data === undefined || json?.data === null) {
    throw new Error(fallbackMessage);
  }
  return json.data;
}

const mutations = {
  billingPortal: () =>
    mutationOptions({
      mutationFn: async () => {
        const res = await client.api.user["billing-portal"].$post();
        return unwrapMutation<{ billingUrl?: string }>(
          res,
          "Failed to create billing portal session",
        );
      },
    }),
  createApiKey: () =>
    mutationOptions({
      mutationFn: async (title: string) => {
        const res = await client.api.apikeys.$post({ json: { title } });
        // data 类型从 RPC 推导（InferResponseType），保持调用点强类型。
        return unwrapMutation<ApiKeyRow>(res, "Failed to create API key");
      },
    }),
  revokeApiKey: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.apikeys.$delete({ query: { id } });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(json?.message || "Failed to revoke API key");
        }
        return id;
      },
    }),
};

export const user = { mutations, queries } as const;
