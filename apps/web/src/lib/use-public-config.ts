import { useQuery } from "@tanstack/react-query";

import { publicConfig } from "@/modules/public-config/lib/api";

export type { PublicConfig } from "@/modules/public-config/lib/api";

export function usePublicConfig() {
  return useQuery({ ...publicConfig.queries.get() });
}
