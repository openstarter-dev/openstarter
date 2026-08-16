// apps/web/src/routes/_app/settings/tickets.tsx
// 工单客服自助面板（R21 / R27.2）：我的工单列表、创建工单、查看消息线程并回复。
// 数据面经类型化 RPC（`client.api.tickets`）→ packages/api（requireAuth，访问隔离仅本人工单）。
import { createFileRoute } from "@tanstack/react-router";
import { TicketsPage } from "@/components/app/settings/tickets";

export const Route = createFileRoute("/_app/settings/tickets")({
  component: TicketsPage,
});
