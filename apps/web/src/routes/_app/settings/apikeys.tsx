import { createFileRoute } from "@tanstack/react-router";

import { ApiKeysPage } from "@/components/app/settings/apikeys";

// 数据由页面内 useQuery 直连 authClient.apiKey.list 获取（官方插件端点），不再经自建 RPC。
export const Route = createFileRoute("/_app/settings/apikeys")({
  component: ApiKeysPage,
});
