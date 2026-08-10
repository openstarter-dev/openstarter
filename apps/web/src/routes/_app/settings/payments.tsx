// apps/web/src/routes/_app/settings/payments.tsx
// 支付记录自助视图（R27.2）：当前用户的订单分页列表。
// 数据面经类型化 RPC（`client.api.user.orders`）→ packages/api（requireAuth）→ user 读投影。

import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/payments")({
  component: PaymentsPage,
});

const PAGE_SIZE = 20;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

function formatAmount(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2);
  return `${value} ${currency.toUpperCase()}`;
}

function statusVariant(status: string): "secondary" | "outline" {
  return status === "paid" ? "secondary" : "outline";
}

function PaymentsPage() {
  const [page, setPage] = useState(1);

  const ordersQuery = useQuery({
    ...user.queries.orders(page),
    placeholderData: keepPreviousData,
  });

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Your order and payment history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ordersQuery.error ? (
          <p className="text-destructive text-sm">
            {(ordersQuery.error as Error).message}
          </p>
        ) : null}

        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {item.orderNo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName ?? item.productId ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(item.amount, item.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.paymentProvider}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>
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
        ) : null}

        {items.length === 0 && !ordersQuery.isPending ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
