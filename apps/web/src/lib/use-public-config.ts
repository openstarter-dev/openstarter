// 公开配置钩子：拉取 /api/config/public（认证相关的非敏感开关），
// 供登录/注册/重置页依据 Config 启用集合决定展示哪些 OAuth 入口与邮箱能力。

import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/api";

export type PublicConfig = Record<string, string>;

async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await client.api.config.public.$get();
  const json = await res.json();
  return json.data ?? {};
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 5 * 60 * 1000,
  });
}
