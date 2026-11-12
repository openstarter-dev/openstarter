import { i18n } from "#i18n";

import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";

import type { AccountSnapshot } from "../lib/types";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

export function AccountPanel(props: {
  data: AccountSnapshot;
  user: { name: string; email: string } | null;
  onManage: () => void;
  onSignOut: () => void;
}) {
  const { subscription } = props.data;

  return (
    <div className="flex flex-col gap-4 p-4">
      {props.user ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{props.user.name}</span>
          <span className="text-muted-foreground text-xs">{props.user.email}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{i18n.t("account.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{i18n.t("account.plan")}</span>
            <Badge variant="secondary">{props.data.plan}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{i18n.t("account.credits")}</span>
            <span className="font-medium text-sm tabular-nums">{props.data.creditsBalance}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{i18n.t("account.subscription")}</span>
            <span className="font-medium text-sm">
              {subscription.hasSubscription
                ? (subscription.status ?? "—")
                : i18n.t("account.no_subscription")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {i18n.t("account.next_billing_date")}
            </span>
            <span className="font-medium text-sm">{formatDate(subscription.nextBillingDate)}</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={props.onManage} type="button" variant="outline">
        {i18n.t("account.manage_in_web_app")}
      </Button>

      <div className="space-y-1">
        <Button onClick={props.onSignOut} type="button" variant="ghost">
          {i18n.t("account.sign_out")}
        </Button>
        <p className="text-muted-foreground text-xs">{i18n.t("account.sign_out_warning")}</p>
      </div>
    </div>
  );
}
