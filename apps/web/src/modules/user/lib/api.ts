import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapMutation, unwrapQuery, withAbort } from "@/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

const PAGE_SIZE = LIST_PAGE_SIZE;

export const userKeys = {
  all: ["user"] as const,
  credits: () => ["user", "credits"] as const,
  orders: (page: number) => ["user", "orders", page] as const,
  plan: () => ["user", "plan"] as const,
  subscription: () => ["user", "subscription"] as const,
  tickets: {
    all: ["user", "tickets"] as const,
    detail: (id: string | null) => ["user", "tickets", id] as const,
  },
};

const getCredits = client.api.user.credits.$get;
const getOrders = client.api.user.orders.$get;
const getPlan = client.api.user.plan.$get;
const getSubscription = client.api.user.subscription.$get;
const createBillingPortal = client.api.user["billing-portal"].$post;

type BillingPortalData = NonNullable<InferResponseType<typeof createBillingPortal, 200>["data"]>;

type CreditsData = NonNullable<InferResponseType<typeof getCredits, 200>["data"]>;
export type CreditHistoryRow = CreditsData["history"][number];

type OrdersData = NonNullable<InferResponseType<typeof getOrders, 200>["data"]>;
type PlanData = NonNullable<InferResponseType<typeof getPlan, 200>["data"]>;
type SubscriptionData = NonNullable<InferResponseType<typeof getSubscription, 200>["data"]>;

const queries = {
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
};

export const user = { mutations, queries } as const;
