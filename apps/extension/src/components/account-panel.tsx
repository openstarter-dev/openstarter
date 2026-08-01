// apps/extension/src/components/account-panel.tsx —— 已登录态：只读账户面板。
// 字段与 apps/web 的 settings/billing.tsx、settings/credits.tsx 对齐（同一后端投影）。
// 见 spec §6。
import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";

import type { AccountSnapshot } from "../lib/state";

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
          <span className="text-muted-foreground text-xs">
            {props.user.email}
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Plan</span>
            <Badge variant="secondary">{props.data.plan}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Credits</span>
            <span className="font-medium text-sm tabular-nums">
              {props.data.creditsBalance}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Subscription</span>
            <span className="font-medium text-sm">
              {subscription.hasSubscription
                ? (subscription.status ?? "—")
                : "No active subscription"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Next billing date
            </span>
            <span className="font-medium text-sm">
              {formatDate(subscription.nextBillingDate)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={props.onManage} type="button" variant="outline">
        Manage in web app
      </Button>

      <div className="space-y-1">
        <Button onClick={props.onSignOut} type="button" variant="ghost">
          Sign out
        </Button>
        <p className="text-muted-foreground text-xs">
          This will also sign you out of the web app, since the extension shares
          its session.
        </p>
      </div>
    </div>
  );
}
