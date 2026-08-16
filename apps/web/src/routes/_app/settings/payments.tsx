// apps/web/src/routes/_app/settings/payments.tsx
// 支付记录自助视图（R27.2）：当前用户的订单分页列表。
// 数据面经类型化 RPC（`client.api.user.orders`）→ packages/api（requireAuth）→ user 读投影。
import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/app/settings/payments";

export const Route = createFileRoute("/_app/settings/payments")({
  component: PaymentsPage,
});
