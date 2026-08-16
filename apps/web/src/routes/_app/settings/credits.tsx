// apps/web/src/routes/_app/settings/credits.tsx
// 积分自助视图（R13 / R27.4）：当前可用余额 + 积分流水历史（grant / consume）。
// 数据面经类型化 RPC（`client.api.user.credits`）→ packages/api（requireAuth）→ Credit_Service。
import { createFileRoute } from "@tanstack/react-router";
import { CreditsPage } from "@/components/app/settings/credits";

export const Route = createFileRoute("/_app/settings/credits")({
  component: CreditsPage,
});
