// Query 工厂：auth 模块（sessions、accounts）
// 使用 better-auth SDK（authClient）而非 Hono RPC。

import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

const queries = {
  sessions: () =>
    queryOptions({
      queryKey: ["auth", "sessions"] as const,
      queryFn: async () => {
        const result = await authClient.listSessions();
        if (result.error) {
          throw new Error(result.error.message || "Failed to load sessions");
        }
        return result.data ?? [];
      },
    }),
  accounts: () =>
    queryOptions({
      queryKey: ["auth", "accounts"] as const,
      queryFn: async () => {
        const result = await authClient.listAccounts();
        if (result.error) {
          throw new Error(result.error.message || "Failed to load accounts");
        }
        return result.data ?? [];
      },
    }),
};

export const auth = { queries } as const;

