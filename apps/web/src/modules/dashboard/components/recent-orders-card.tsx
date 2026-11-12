import { m } from "@openstarter/i18n-web/messages";
import { Badge } from "@openstarter/ui-web/components/badge";
import { buttonVariants } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardAction,
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
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { user } from "@/modules/user/lib/api";

const PREVIEW_COUNT = 5;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

function formatAmount(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function RecentOrdersCard() {
  const ordersQuery = useQuery(user.queries.orders(1));

  const items = (ordersQuery.data?.items ?? []).slice(0, PREVIEW_COUNT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["dashboard.recent_orders.title"]()}</CardTitle>
        <CardDescription>{m["dashboard.recent_orders.description"]()}</CardDescription>
        <CardAction>
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            to="/settings/payments"
          >
            {m["dashboard.recent_orders.view_all"]()}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ordersQuery.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="h-9 w-full" key={index} />
            ))}
          </div>
        ) : ordersQuery.error ? (
          <p className="text-destructive text-sm">{(ordersQuery.error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{m["dashboard.recent_orders.empty"]()}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-32 truncate font-medium">{item.orderNo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.productName ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(item.amount, item.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "paid" ? "secondary" : "outline"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
