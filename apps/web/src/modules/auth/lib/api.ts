import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

/** auth 域 query key 工厂。 */
export const authKeys = {
  all: ["auth"] as const,
  accounts: () => ["auth", "accounts"] as const,
  sessions: () => ["auth", "sessions"] as const,
};

const queries = {
  accounts: () =>
    queryOptions({
      queryFn: async () => {
        const result = await authClient.listAccounts();
        if (result.error) {
          throw new Error(result.error.message || "Failed to load accounts");
        }
        return result.data ?? [];
      },
      queryKey: authKeys.accounts(),
    }),
  sessions: () =>
    queryOptions({
      queryFn: async () => {
        const result = await authClient.listSessions();
        if (result.error) {
          throw new Error(result.error.message || "Failed to load sessions");
        }
        return result.data ?? [];
      },
      queryKey: authKeys.sessions(),
    }),
};

export const auth = { queries } as const;
