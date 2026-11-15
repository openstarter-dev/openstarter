import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapQuery, withAbort } from "@/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

const PAGE_SIZE = LIST_PAGE_SIZE;

export const adminKeys = {
  all: ["admin"] as const,
  credits: (page: number) => ["admin", "credits", page] as const,
  metrics: () => ["admin", "metrics"] as const,
  orders: (page: number) => ["admin", "orders", page] as const,
  subscriptions: (page: number) => ["admin", "subscriptions", page] as const,
  users: (page: number, search: string) => ["admin", "users", page, search] as const,
} as const;

const getCredits = client.api.admin.credits.$get;
const getMetrics = client.api.admin.analytics.metrics.$get;
const getOrders = client.api.admin.orders.$get;
const getSubscriptions = client.api.admin.subscriptions.$get;
const getUsers = client.api.admin.users.$get;

type CreditListData = NonNullable<InferResponseType<typeof getCredits, 200>["data"]>;
type MetricsData = NonNullable<InferResponseType<typeof getMetrics, 200>["data"]>;
type OrderListData = NonNullable<InferResponseType<typeof getOrders, 200>["data"]>;
type SubscriptionListData = NonNullable<InferResponseType<typeof getSubscriptions, 200>["data"]>;
type UserListData = NonNullable<InferResponseType<typeof getUsers, 200>["data"]>;

export type AdminCreditRow = CreditListData["items"][number];
export type AdminOrderRow = OrderListData["items"][number];
export type AdminSubscriptionRow = SubscriptionListData["items"][number];
export type AdminUserRow = UserListData["items"][number];

const queries = {
  credits: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getCredits(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<CreditListData>(res, "Failed to load credits");
      },
      queryKey: adminKeys.credits(page),
      placeholderData: keepPreviousData,
    }),
  metrics: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getMetrics(undefined, withAbort(signal));
        return unwrapQuery<MetricsData>(res, "Failed to load metrics");
      },
      queryKey: adminKeys.metrics(),
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getOrders(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<OrderListData>(res, "Failed to load orders");
      },
      queryKey: adminKeys.orders(page),
      placeholderData: keepPreviousData,
    }),
  subscriptions: (page: number) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getSubscriptions(
          { query: { page: String(page), pageSize: String(PAGE_SIZE) } },
          withAbort(signal),
        );
        return unwrapQuery<SubscriptionListData>(res, "Failed to load subscriptions");
      },
      queryKey: adminKeys.subscriptions(page),
      placeholderData: keepPreviousData,
    }),
  users: (page: number, search: string) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getUsers(
          {
            query: {
              page: String(page),
              pageSize: String(PAGE_SIZE),
              ...(search ? { search } : {}),
            },
          },
          withAbort(signal),
        );
        return unwrapQuery<UserListData>(res, "Failed to load users");
      },
      queryKey: adminKeys.users(page, search),
      placeholderData: keepPreviousData,
    }),
};

export const admin = { queries } as const;
