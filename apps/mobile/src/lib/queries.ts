// apps/mobile/src/lib/queries.ts —— 经类型化客户端拉数据的 TanStack Query 钩子。
//
// 会话状态刻意不进 Query：它走 authClient.useSession() 自己的 store，
// 两套缓存并存只会互相打架（见 spec §5.4）。
//
// 每个查询都返回 ApiResult 而不是抛异常：401 是"未登录"而不是错误，
// 交给界面按 status 分流（见 spec §7）。因此 queryFn 永不 reject，
// retry 也就没有意义 —— 重试由界面上的显式按钮驱动。
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./api";
import { type ApiResult, runRequest } from "./api-error";
import type { PublicConfig } from "./public-config";

const PUBLIC_CONFIG_STALE_MS = 5 * 60 * 1000;

export interface UserPlanView {
  plan: string;
  trialEndsAt: string | null;
}

export function usePublicConfig() {
  return useQuery({
    queryFn: async (): Promise<PublicConfig> => {
      const result = await runRequest(
        () => apiClient.api.config.public.$get(),
        (body) => (body as { data?: PublicConfig }).data ?? {},
      );
      // 公开配置拿不到时退回空对象：resolveEnabledProviders({}) 的结果是
      // "只有邮箱密码"，这是最保守也最不会 404 的降级（见 spec §6）。
      return result.status === "success" ? result.data : {};
    },
    queryKey: ["public-config"],
    staleTime: PUBLIC_CONFIG_STALE_MS,
  });
}

export function useUserPlan() {
  return useQuery({
    queryFn: (): Promise<ApiResult<UserPlanView>> =>
      runRequest(
        () => apiClient.api.user.plan.$get(),
        (body) => {
          // JSON 线上传输：Date 序列化为 ISO 字符串，故 trialEndsAt 是 string 而非 Date。
          const { data } = body as {
            data: { plan: string; trialEndsAt?: string };
          };
          return { plan: data.plan, trialEndsAt: data.trialEndsAt ?? null };
        },
      ),
    queryKey: ["user-plan"],
    retry: false,
  });
}
