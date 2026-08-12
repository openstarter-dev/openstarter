import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./api-context";

export function useCreditsQuery() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const res = await api.api.user.credits.$get({ query: {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.balance;
    },
  });
}

export function usePlanQuery() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: ["plan"],
    queryFn: async () => {
      const res = await api.api.user.plan.$get();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data.plan;
    },
  });
}

export function useSubscriptionQuery() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await api.api.user.subscription.$get();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    },
  });
}
