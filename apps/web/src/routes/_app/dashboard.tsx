// apps/web/src/routes/_app/dashboard.tsx
// 仪表盘：标准 SaaS 概览布局 —— 顶部欢迎语 + 六格 KPI 统计卡 + 积分动态图 + 最近订单 + 快速开始。
// 数据面经类型化 RPC（`client.api.user.dashboard-stats`）→ packages/api（requireAuth）。

import { m } from "@openstarter/i18n-web/messages";
import { Alert, AlertDescription, AlertTitle } from "@openstarter/ui-web/components/alert";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { CreditActivityChart } from "@/modules/dashboard/components/credit-activity-chart";
import { RecentOrdersCard } from "@/modules/dashboard/components/recent-orders-card";
import { StatsCards } from "@/modules/dashboard/components/stats-cards";
import { dashboard } from "@/modules/dashboard/lib/api";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/dashboard")({
  // intent 预加载：hover 时先跑 loader，把 stats + 最近订单预取进 Query 缓存，
  // 点击后组件的 useQuery 直接命中缓存 → 无等待渲染。
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.prefetchQuery(dashboard.queries.stats()),
      queryClient.prefetchQuery(user.queries.orders(1)),
    ]),
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const name = session.data?.user.name ?? "there";

  const statsQuery = useQuery({ ...dashboard.queries.stats() });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">{m["dashboard.title"]()}</h1>
        <p className="text-muted-foreground">{m["dashboard.welcome"]({ name })}</p>
      </div>

      {statsQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{m["dashboard.error"]()}</AlertTitle>
          <AlertDescription>{(statsQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      <StatsCards isPending={statsQuery.isPending} stats={statsQuery.data} />

      <CreditActivityChart isPending={statsQuery.isPending} stats={statsQuery.data} />

      <RecentOrdersCard />
    </div>
  );
}
