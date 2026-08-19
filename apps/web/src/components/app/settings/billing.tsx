import { Badge } from "@openstarter/ui-web/components/badge";
import { Button, buttonVariants } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { user } from "@/modules/user/lib/api";

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

export function BillingPage() {
  const subscriptionQuery = useQuery({ ...user.queries.subscription() });

  const planQuery = useQuery({ ...user.queries.plan() });

  const subscription = subscriptionQuery.data;
  const plan = planQuery.data;
  const isLoading = subscriptionQuery.isPending || planQuery.isPending;

  const billingPortalMutation = useMutation({
    ...user.mutations.billingPortal(),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal");
    },
    onSuccess: (data: { billingUrl?: string } | undefined) => {
      if (data?.billingUrl) {
        window.location.href = data.billingUrl;
      }
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Your current plan and subscription status.</CardDescription>
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
              <p className="font-medium text-sm">{subscription?.planName ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">Next billing date</p>
              <p className="font-medium text-sm">{formatDate(subscription?.nextBillingDate)}</p>
            </div>
          </div>

          <Link className={buttonVariants()} to="/pricing">
            View plans
          </Link>

          {subscription?.hasSubscription ? (
            <Button
              disabled={billingPortalMutation.isPending}
              onClick={() => billingPortalMutation.mutate()}
              variant="outline"
            >
              {billingPortalMutation.isPending ? "Opening..." : "Manage on Stripe"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
