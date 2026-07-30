// apps/web/src/routes/admin/index.tsx
// 管理后台首页（R25.4 / R26.5）：展示 Analytics_Service 汇总指标概览（用户/订单/订阅/积分消耗）。

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminHeader } from "@/components/admin/list";
import { client } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const METRIC_CARDS = [
  { key: "userCount", label: "Users" },
  { key: "orderCount", label: "Orders" },
  { key: "subscriptionCount", label: "Subscriptions" },
  { key: "creditsConsumed", label: "Credits consumed" },
] as const;

function AdminDashboard() {
  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const res = await client.api.admin.analytics.metrics.$get();
      if (!res.ok) {
        throw new Error("Failed to load metrics");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const metrics = metricsQuery.data;

  return (
    <div>
      <AdminHeader
        description="Key platform metrics at a glance."
        title="Dashboard"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_CARDS.map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {metricsQuery.isPending
                  ? "—"
                  : (metrics?.[card.key] ?? 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
      {metricsQuery.error ? (
        <p className="mt-4 text-destructive text-sm">
          {(metricsQuery.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}
