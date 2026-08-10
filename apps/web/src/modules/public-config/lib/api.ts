// Query 工厂：public-config 模块
// 拉取 /api/config/public，供登录/注册/重置页使用。

import { queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

export type PublicConfig = Record<string, string>;

const queries = {
  get: () =>
    queryOptions({
      queryFn: async (): Promise<PublicConfig> => {
        const res = await client.api.config.public.$get();
        if (!res.ok) {
          throw new Error("Failed to load public config");
        }
        const json = await res.json();
        return json.data ?? {};
      },
      queryKey: ["public-config"] as const,
      staleTime: 5 * 60 * 1000,
    }),
};

export const publicConfig = { queries } as const;
