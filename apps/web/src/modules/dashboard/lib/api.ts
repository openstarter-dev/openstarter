import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapQuery, withAbort } from "@/lib/api";

const getStats = client.api.user["dashboard-stats"].$get;

type DashboardStats = NonNullable<InferResponseType<typeof getStats, 200>["data"]>;

/** dashboard 域 query key 工厂。 */
export const dashboardKeys = {
  stats: () => ["dashboard", "stats"] as const,
};

const queries = {
  stats: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getStats(undefined, withAbort(signal));
        return unwrapQuery<DashboardStats>(res, "Failed to load dashboard stats");
      },
      queryKey: dashboardKeys.stats(),
      refetchOnWindowFocus: true,
      staleTime: 0,
    }),
};

export const dashboard = { queries } as const;
