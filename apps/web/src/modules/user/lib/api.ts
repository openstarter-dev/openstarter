// Query 工厂：user settings 模块（R8/R11/R13/R27）
// 数据面经类型化 RPC（`client.api.*`）→ packages/api（requireAuth）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

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
      queryKey: ["user", "apikeys"] as const,
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
      queryKey: ["user", "credits"] as const,
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
      queryKey: ["user", "orders", page] as const,
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
      queryKey: ["user", "plan"] as const,
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
      queryKey: ["user", "subscription"] as const,
    }),
};

const mutations = {
  billingPortal: () =>
    mutationOptions({
      mutationFn: async () => {
        const res = await client.api.user["billing-portal"].$post();
        if (!res.ok) {
          const json = await res.json();
          throw new Error(
            (json as { message?: string }).message ?? "Failed to create billing portal session",
          );
        }
        const json = await res.json();
        return json.data as { billingUrl?: string } | undefined;
      },
    }),
  createApiKey: () =>
    mutationOptions({
      mutationFn: async (title: string) => {
        const res = await client.api.apikeys.$post({ json: { title } });
        if (!res.ok) {
          throw new Error("Failed to create API key");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to create API key");
        }
        return json.data;
      },
    }),
  revokeApiKey: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.apikeys.$delete({ query: { id } });
        if (!res.ok) {
          throw new Error("Failed to revoke API key");
        }
        return id;
      },
    }),
};

export const user = { mutations, queries } as const;
