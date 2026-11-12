// apps/web/src/routes/admin/index.tsx
// 管理后台首页（R25.4 / R26.5）：展示 Analytics_Service 汇总指标概览（用户/订单/订阅/积分消耗）。

import { m } from "@openstarter/i18n-web/messages";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminHeader } from "@/components/admin/list";
import { admin } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(admin.queries.metrics()),
  component: AdminDashboard,
});

const METRIC_CARDS = [
  { key: "userCount", label: () => m["admin.dashboard.users"]() },
  { key: "orderCount", label: () => m["admin.dashboard.orders"]() },
  { key: "subscriptionCount", label: () => m["admin.dashboard.subscriptions"]() },
  { key: "creditsConsumed", label: () => m["admin.dashboard.credits_consumed"]() },
] as const;

function AdminDashboard() {
  const metricsQuery = useQuery({ ...admin.queries.metrics() });

  const metrics = metricsQuery.data;

  return (
    <div>
      <AdminHeader
        description={m["admin.dashboard.description"]()}
        title={m["admin.dashboard.title"]()}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_CARDS.map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardDescription>{card.label()}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {metricsQuery.isPending ? "—" : (metrics?.[card.key] ?? 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
      {metricsQuery.error ? (
        <p className="mt-4 text-destructive text-sm">{(metricsQuery.error as Error).message}</p>
      ) : null}
    </div>
  );
}
