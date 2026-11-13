import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { assertOk, client, unwrapMutation, unwrapQuery, withAbort } from "@/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

const PAGE_SIZE = LIST_PAGE_SIZE;

/**
 * user 域 query key 工厂（分层前缀，失效可粗可细；tickets 等相邻模块共用）。
 */
export const userKeys = {
  all: ["user"] as const,
  apiKeys: () => ["user", "apikeys"] as const,
  credits: () => ["user", "credits"] as const,
  orders: (page: number) => ["user", "orders", page] as const,
  plan: () => ["user", "plan"] as const,
  subscription: () => ["user", "subscription"] as const,
  tickets: {
    all: ["user", "tickets"] as const,
    detail: (id: string | null) => ["user", "tickets", id] as const,
  },
};

const getApiKeys = client.api.apikeys.$get;
const getCredits = client.api.user.credits.$get;
const getOrders = client.api.user.orders.$get;
const getPlan = client.api.user.plan.$get;
const getSubscription = client.api.user.subscription.$get;
const createBillingPortal = client.api.user["billing-portal"].$post;

type ApiKeyListData = NonNullable<InferResponseType<typeof getApiKeys, 200>["data"]>;
/** 创建 API key 的响应 data（含一次性展示的明文 key），从 RPC 响应推导。 */
type ApiKeyRow = NonNullable<InferResponseType<typeof client.api.apikeys.$post, 200>["data"]>;
/** 计费 portal 响应 data；不手写形状，后端字段变更直接在这里报错。 */
type BillingPortalData = NonNullable<InferResponseType<typeof createBillingPortal, 200>["data"]>;

type CreditsData = NonNullable<InferResponseType<typeof getCredits, 200>["data"]>;
/** 用户积分流水行（积分历史列表），从 user.credits 响应推导。 */
export type CreditHistoryRow = CreditsData["history"][number];

type OrdersData = NonNullable<InferResponseType<typeof getOrders, 200>["data"]>;
type PlanData = NonNullable<InferResponseType<typeof getPlan, 200>["data"]>;
type SubscriptionData = NonNullable<InferResponseType<typeof getSubscription, 200>["data"]>;

const queries = {
  apiKeys: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getApiKeys({ query: {} }, withAbort(signal));
        return unwrapQuery<ApiKeyListData>(res, "Failed to load API keys");
      },
      queryKey: userKeys.apiKeys(),
    }),
  credits: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getCredits({ query: {} }, withAbort(signal));
        return unwrapQuery<CreditsData>(res, "Failed to load credits");
      },
      queryKey: userKeys.credits(),
      refetchOnWindowFocus: true,
      staleTime: 0,
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getOrders(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<OrdersData>(res, "Failed to load payments");
      },
      placeholderData: keepPreviousData,
      queryKey: userKeys.orders(page),
      refetchOnWindowFocus: true,
      staleTime: 0,
    }),
  plan: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getPlan(undefined, withAbort(signal));
        return unwrapQuery<PlanData>(res, "Failed to load plan");
      },
      queryKey: userKeys.plan(),
      refetchOnWindowFocus: true,
      staleTime: 0,
    }),
  subscription: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getSubscription(undefined, withAbort(signal));
        return unwrapQuery<SubscriptionData>(res, "Failed to load subscription");
      },
      queryKey: userKeys.subscription(),
      refetchOnWindowFocus: true,
      staleTime: 0,
    }),
};

const mutations = {
  billingPortal: () =>
    mutationOptions({
      mutationFn: async () => {
        const res = await client.api.user["billing-portal"].$post();
        return unwrapMutation<BillingPortalData>(
          res,
          "Failed to create billing portal session",
        );
      },
    }),
  createApiKey: () =>
    mutationOptions({
      meta: { invalidates: [userKeys.apiKeys()] },
      mutationFn: async (title: string) => {
        const res = await client.api.apikeys.$post({ json: { title } });
        return unwrapMutation<ApiKeyRow>(res, "Failed to create API key");
      },
    }),
  revokeApiKey: () =>
    mutationOptions({
      meta: { invalidates: [userKeys.apiKeys()] },
      mutationFn: async (id: string) => {
        const res = await client.api.apikeys.$delete({ query: { id } });
        await assertOk(res, "Failed to revoke API key");
        return id;
      },
    }),
};

export const user = { mutations, queries } as const;
