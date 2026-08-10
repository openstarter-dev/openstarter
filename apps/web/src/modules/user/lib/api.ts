// Query 工厂：user settings 模块（R8/R11/R13/R27）
// 数据面经类型化 RPC（`client.api.*`）→ packages/api（requireAuth）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

const queries = {
  apiKeys: () =>
    queryOptions({
      queryKey: ["user", "apikeys"] as const,
      queryFn: async () => {
        const res = await client.api.apikeys.$get({ query: {} });
        if (!res.ok) throw new Error("Failed to load API keys");
        const json = await res.json();
        return json.data;
      },
    }),
  subscription: () =>
    queryOptions({
      queryKey: ["user", "subscription"] as const,
      queryFn: async () => {
        const res = await client.api.user.subscription.$get();
        if (!res.ok) throw new Error("Failed to load subscription");
        const json = await res.json();
        return json.data;
      },
    }),
  plan: () =>
    queryOptions({
      queryKey: ["user", "plan"] as const,
      queryFn: async () => {
        const res = await client.api.user.plan.$get();
        if (!res.ok) throw new Error("Failed to load plan");
        const json = await res.json();
        return json.data;
      },
    }),
  credits: () =>
    queryOptions({
      queryKey: ["user", "credits"] as const,
      queryFn: async () => {
        const res = await client.api.user.credits.$get({ query: {} });
        if (!res.ok) throw new Error("Failed to load credits");
        const json = await res.json();
        return json.data;
      },
    }),
  orders: (page: number) =>
    queryOptions({
      queryKey: ["user", "orders", page] as const,
      queryFn: async () => {
        const res = await client.api.user.orders.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) throw new Error("Failed to load payments");
        const json = await res.json();
        return json.data;
      },
    }),
};

const mutations = {
  createApiKey: () =>
    mutationOptions({
      mutationFn: async (title: string) => {
        const res = await client.api.apikeys.$post({ json: { title } });
        if (!res.ok) throw new Error("Failed to create API key");
        const json = await res.json();
        if (!json.data) throw new Error("Failed to create API key");
        return json.data;
      },
    }),
  revokeApiKey: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.apikeys.$delete({ query: { id } });
        if (!res.ok) throw new Error("Failed to revoke API key");
        return id;
      },
    }),
  billingPortal: () =>
    mutationOptions({
      mutationFn: async () => {
        const res = await client.api.user["billing-portal"].$post();
        if (!res.ok) {
          const json = await res.json();
          throw new Error(
            (json as { message?: string }).message ??
              "Failed to create billing portal session",
          );
        }
        const json = await res.json();
        return json.data as { billingUrl?: string } | undefined;
      },
    }),
};

export const user = { queries, mutations } as const;

