// apps/web/src/routes/_app/settings/billing.tsx
// 账单/订阅自助视图（R11.4 / R27.2）：当前订阅状态、套餐名、下一计费日与方案状态。
// 数据面经类型化 RPC（`client.api.user.subscription` / `client.api.user.plan`）。
import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/app/settings/billing";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
});
