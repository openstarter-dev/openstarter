import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./api-context";

/**
 * Build an Error carrying HTTP status so QueryCache can detect 401 and trigger sign-out.
 * 构造携带 HTTP 状态码的错误对象，供 QueryCache 识别 401 并切换未登录态。
 */
function createHttpError(status: number): Error & { status: number } {
  const err = new Error(`HTTP ${status}`) as Error & { status: number };
  err.status = status;
  return err;
}

export function useCreditsQuery() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const res = await api.api.user.credits.$get({ query: {} });
      if (!res.ok) throw createHttpError(res.status);
      const json = await res.json();
      if (!json.data) throw new Error("Missing credits data in response");
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
      if (!res.ok) throw createHttpError(res.status);
      const json = await res.json();
      if (!json.data) throw new Error("Missing plan data in response");
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
      if (!res.ok) throw createHttpError(res.status);
      const json = await res.json();
      return json.data;
    },
  });
}

export function useUserQuery() {
  const { auth } = useApiClient();
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await auth.getSession();
      if (data?.user) {
        return {
          name: data.user.name,
          email: data.user.email,
        };
      }
      return null;
    },
  });
}
