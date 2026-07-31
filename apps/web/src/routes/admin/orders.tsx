// apps/web/src/routes/admin/orders.tsx
// 订单管理（R26.2）：分页列表。数据经 GET /api/admin/orders（requirePermission admin.*）。

import { Badge } from "@openstarter/ui-web/components/badge";
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

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { client } from "@/lib/api";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
});

const PAGE_SIZE = 20;

function formatAmount(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function AdminOrdersPage() {
  const [page, setPage] = useState(1);

  const ordersQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await client.api.admin.orders.$get({
        query: { page: String(page), pageSize: String(PAGE_SIZE) },
      });
      if (!res.ok) {
        throw new Error("Failed to load orders");
      }
      const json = await res.json();
      return json.data;
    },
    queryKey: ["admin", "orders", page],
  });

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader description="All customer orders." title="Orders" />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No orders found."
        error={ordersQuery.error as Error | null}
        loading={ordersQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    {item.orderNo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
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
                    <Badge
                      variant={item.status === "paid" ? "secondary" : "outline"}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pagination onPageChange={setPage} page={page} totalPages={totalPages} />
    </div>
  );
}
