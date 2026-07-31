// apps/web/src/routes/admin/credits.tsx
// 积分管理（R26.2）：分页列表。数据经 GET /api/admin/credits（requirePermission admin.*）。

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

export const Route = createFileRoute("/admin/credits")({
  component: AdminCreditsPage,
});

const PAGE_SIZE = 20;

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

function AdminCreditsPage() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await client.api.admin.credits.$get({
        query: { page: String(page), pageSize: String(PAGE_SIZE) },
      });
      if (!res.ok) {
        throw new Error("Failed to load credits");
      }
      const json = await res.json();
      return json.data;
    },
    queryKey: ["admin", "credits", page],
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader description="All credit transactions." title="Credits" />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No credit transactions found."
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
                  </TableCell>
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
                  <TableCell className="tabular-nums">{item.credits}</TableCell>
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

      <Pagination onPageChange={setPage} page={page} totalPages={totalPages} />
    </div>
  );
}
