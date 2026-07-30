// apps/web/src/routes/admin/subscriptions.tsx
// 订阅管理（R26.2）：分页列表。数据经 GET /api/admin/subscriptions（requirePermission admin.*）。

import { Badge } from "@openstarter/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui/components/table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { client } from "@/lib/api";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptionsPage,
});

const PAGE_SIZE = 20;

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "subscriptions", page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await client.api.admin.subscriptions.$get({
        query: { page: String(page), pageSize: String(PAGE_SIZE) },
      });
      if (!res.ok) {
        throw new Error("Failed to load subscriptions");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader
        description="All customer subscriptions."
        title="Subscriptions"
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No subscriptions found."
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period end</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.planName ?? item.productName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.paymentProvider}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "active" ? "secondary" : "outline"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.currentPeriodEnd)}
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
