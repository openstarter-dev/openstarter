import { m } from "@openstarter/i18n-web/messages";
import { Card, CardContent } from "@openstarter/ui-web/components/card";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Activity, CreditCard, KeyRound, Coins, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardStats } from "./stats-view";

interface StatCardProps {
  hint: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

function StatCard({ hint, icon: Icon, label, value }: StatCardProps) {
  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex flex-col gap-1 px-5">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">{label}</p>
          <div className="flex size-7 items-center justify-center rounded-md bg-muted">
            <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </div>
        </div>
        <p className="font-semibold text-xl tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function StatsCards({
  isPending,
  stats,
}: {
  isPending: boolean;
  stats: DashboardStats | undefined;
}) {
  if (isPending || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card className="py-5" key={index}>
            <CardContent className="flex flex-col gap-2 px-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const spendValue = stats.spendTotal
    ? `${(stats.spendTotal.total / 100).toFixed(2)} ${stats.spendTotal.currency}`
    : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        hint={m["dashboard.stat.credits_balance_hint"]()}
        icon={Coins}
        label={m["dashboard.stat.credits_balance"]()}
        value={formatNumber(stats.balance)}
      />
      <StatCard
        hint={m["dashboard.stat.granted_30d_hint"]()}
        icon={TrendingUp}
        label={m["dashboard.stat.granted_30d"]()}
        value={`+${formatNumber(stats.creditsGranted30d)}`}
      />
      <StatCard
        hint={m["dashboard.stat.consumed_30d_hint"]()}
        icon={Activity}
        label={m["dashboard.stat.consumed_30d"]()}
        value={formatNumber(stats.creditsConsumed30d)}
      />
      <StatCard
        hint={m["dashboard.stat.spend_hint"]()}
        icon={Wallet}
        label={m["dashboard.stat.spend"]()}
        value={spendValue}
      />
      <StatCard
        hint={m["dashboard.stat.orders_hint"]({
          paid: String(stats.paidOrdersCount),
          total: String(stats.ordersCount),
        })}
        icon={CreditCard}
        label={m["dashboard.stat.orders"]()}
        value={formatNumber(stats.ordersCount)}
      />
      <StatCard
        hint={m["dashboard.stat.apikeys_hint"]()}
        icon={KeyRound}
        label={m["dashboard.stat.apikeys"]()}
        value={formatNumber(stats.activeApiKeys)}
      />
    </div>
  );
}
