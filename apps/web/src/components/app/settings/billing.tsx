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
import { m } from "@/paraglide/messages.js";

const PLAN_LABEL: Record<string, string> = {
  expired: m["settings.billing.plan_expired"](),
  member: m["settings.billing.plan_member"](),
  none: m["settings.billing.plan_free"](),
  trial: m["settings.billing.plan_trial"](),
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
      toast.error(err instanceof Error ? err.message : m["settings.billing.portal_failed"]());
    },
    onSuccess: (data) => {
      if (data?.billingUrl) {
        window.location.href = data.billingUrl;
      }
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m["settings.billing.plan"]()}</CardTitle>
          <CardDescription>{m["settings.billing.subscription_details"]()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{m["settings.billing.loading"]()}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">
                {plan ? (PLAN_LABEL[plan.plan] ?? plan.plan) : m["settings.billing.unknown"]()}
              </Badge>
              {plan?.trialEndsAt ? (
                <span className="text-muted-foreground text-sm">
                  {m["settings.billing.trial_ends"]({ date: formatDate(plan.trialEndsAt) })}
                </span>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{m["settings.billing.status"]()}</p>
              <p className="font-medium text-sm">
                {subscription?.hasSubscription
                  ? (subscription.status ?? "—")
                  : m["settings.billing.no_subscription"]()}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{m["settings.billing.plan_name"]()}</p>
              <p className="font-medium text-sm">{subscription?.planName ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">
                {m["settings.billing.next_billing_date"]()}
              </p>
              <p className="font-medium text-sm">{formatDate(subscription?.nextBillingDate)}</p>
            </div>
          </div>

          <Link className={buttonVariants()} to="/pricing">
            {m["settings.billing.view_plans"]()}
          </Link>

          {subscription?.hasSubscription ? (
            <Button
              disabled={billingPortalMutation.isPending}
              onClick={() => billingPortalMutation.mutate()}
              variant="outline"
            >
              {billingPortalMutation.isPending
                ? m["settings.billing.opening"]()
                : m["settings.billing.manage_stripe"]()}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
