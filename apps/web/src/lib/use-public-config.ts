import { useQuery } from "@tanstack/react-query";

import { publicConfig, type PublicConfig } from "@/modules/public-config/lib/api";

export type { PublicConfig };

export function usePublicConfig() {
  return useQuery({ ...publicConfig.queries.get() });
}
