import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapQuery, withAbort } from "@/lib/api";

export type PublicConfig = NonNullable<
  InferResponseType<typeof client.api.config.public.$get, 200>["data"]
>;

/** 公共配置 query key（登录前页面共用，长期缓存）。 */
export const publicConfigKeys = {
  get: () => ["public-config"] as const,
};

const getPublicConfig = client.api.config.public.$get;

const queries = {
  get: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getPublicConfig(undefined, withAbort(signal));
        return (await unwrapQuery<PublicConfig>(res, "Failed to load public config")) ?? {};
      },
      queryKey: publicConfigKeys.get(),
      staleTime: 5 * 60 * 1000,
    }),
};

export const publicConfig = { queries } as const;
