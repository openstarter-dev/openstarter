// apps/web/src/routes/_app/settings/billing.tsx
// 账单/订阅自助视图（R11.4 / R27.2）：当前订阅状态、套餐名、下一计费日与方案状态。
// 数据面经类型化 RPC（`client.api.user.subscription` / `client.api.user.plan`）。

import { Badge } from "@openstarter/ui/components/badge";
import { buttonVariants } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { client } from "@/lib/api";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
});

const PLAN_LABEL: Record<string, string> = {
  expired: "Expired",
  member: "Member",
  none: "Free",
  trial: "Trial",
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

function BillingPage() {
  const subscriptionQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.user.subscription.$get();
      if (!res.ok) {
        throw new Error("Failed to load subscription");
      }
      const json = await res.json();
      return json.data;
    },
    queryKey: ["user", "subscription"],
  });

  const planQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.user.plan.$get();
      if (!res.ok) {
        throw new Error("Failed to load plan");
      }
      const json = await res.json();
      return json.data;
    },
    queryKey: ["user", "plan"],
  });

  const subscription = subscriptionQuery.data;
  const plan = planQuery.data;
  const isLoading = subscriptionQuery.isPending || planQuery.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            Your current plan and subscription status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">
                {plan ? (PLAN_LABEL[plan.plan] ?? plan.plan) : "Unknown"}
              </Badge>
              {plan?.trialEndsAt ? (
                <span className="text-muted-foreground text-sm">
                  Trial ends {formatDate(plan.trialEndsAt)}
                </span>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="font-medium text-sm">
                {subscription?.hasSubscription
                  ? (subscription.status ?? "—")
                  : "No active subscription"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">Plan name</p>
              <p className="font-medium text-sm">
                {subscription?.planName ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">Next billing date</p>
              <p className="font-medium text-sm">
                {formatDate(subscription?.nextBillingDate)}
              </p>
            </div>
          </div>

          <Link className={buttonVariants()} to="/pricing">
            View plans
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
