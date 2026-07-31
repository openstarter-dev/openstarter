// apps/web/src/routes/_app/settings/credits.tsx
// 积分自助视图（R13 / R27.4）：当前可用余额 + 积分流水历史（grant / consume）。
// 数据面经类型化 RPC（`client.api.user.credits`）→ packages/api（requireAuth）→ Credit_Service。

import { Badge } from "@openstarter/ui-web/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { client } from "@/lib/api";

export const Route = createFileRoute("/_app/settings/credits")({
  component: CreditsPage,
});

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleDateString();
}

function CreditsPage() {
  const creditsQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.user.credits.$get({ query: {} });
      if (!res.ok) {
        throw new Error("Failed to load credits");
      }
      const json = await res.json();
      return json.data;
    },
    queryKey: ["user", "credits"],
  });

  const balance = creditsQuery.data?.balance ?? 0;
  const history = creditsQuery.data?.history ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
          <CardDescription>
            Your available balance and transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">Available balance</p>
            <p className="font-bold text-3xl tabular-nums">
              {creditsQuery.isPending ? "—" : balance.toLocaleString()}
            </p>
          </div>

          {creditsQuery.error ? (
            <p className="text-destructive text-sm">
              {(creditsQuery.error as Error).message}
            </p>
          ) : null}

          {history.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge
                          variant={
                            item.transactionType === "grant"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {item.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {item.credits}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {item.remainingCredits}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.expiresAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {history.length === 0 && !creditsQuery.isPending ? (
            <p className="text-muted-foreground text-sm">
              No credit transactions yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
