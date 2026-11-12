import { m } from "@openstarter/i18n-web/messages";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { LineChart } from "@openstarter/ui-web/components/line-chart";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";

import type { DashboardStats } from "./stats-view";

/** 轴刻度只显示 `MM-DD`，避免横轴拥挤。 */
function formatTick(date: string): string {
  return date.slice(5);
}

export function CreditActivityChart({
  isPending,
  stats,
}: {
  isPending: boolean;
  stats: DashboardStats | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["dashboard.chart.title"]()}</CardTitle>
        <CardDescription>{m["dashboard.chart.description"]()}</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending || !stats ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <LineChart
            ariaLabel={m["dashboard.chart.aria"]()}
            data={stats.trend}
            dateLabel={m["dashboard.chart.date"]()}
            formatTickLabel={formatTick}
            series={[
              { dataKey: "granted", label: m["dashboard.chart.granted"]() },
              { dataKey: "consumed", label: m["dashboard.chart.consumed"]() },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
