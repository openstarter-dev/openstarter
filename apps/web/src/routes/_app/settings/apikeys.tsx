// apps/web/src/routes/_app/settings/apikeys.tsx
// API 密钥自助管理（R8 / R27.2）：创建（明文一次性展示）、列表（仅前缀）、吊销。
// 数据面经类型化 RPC（`client.api.apikeys`）→ packages/api（requireAuth）→ Auth APIKey_Service。
import { createFileRoute } from "@tanstack/react-router";
import { ApiKeysPage } from "@/components/app/settings/apikeys";

export const Route = createFileRoute("/_app/settings/apikeys")({
  component: ApiKeysPage,
});
