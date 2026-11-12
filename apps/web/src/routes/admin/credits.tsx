import { m } from "@openstarter/i18n-web/messages";
import { Badge } from "@openstarter/ui-web/components/badge";
import { useQuery } from "@tanstack/react-query";
import { legacyCreateColumnHelper } from "@tanstack/react-table/legacy";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { countTotalPages, listSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { admin, type AdminCreditRow } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/credits")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.credits(Number(deps.page) || 1)]),
  component: AdminCreditsPage,
});

const columnHelper = legacyCreateColumnHelper<AdminCreditRow>();

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : m["common.never"]();
}

function AdminCreditsPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = useQuery(admin.queries.credits(page));

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const columns = useMemo<DataColumn<AdminCreditRow>[]>(
    () => [
      columnHelper.accessor((row) => row.userEmail ?? row.userId, {
        id: "user",
        header: () => m["admin.credits.user"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("transactionType", {
        header: () => m["admin.credits.type"](),
        cell: (info) => (
          <Badge variant={info.getValue() === "grant" ? "secondary" : "outline"}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("credits", {
        header: () => m["admin.credits.amount"](),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("remainingCredits", {
        header: () => m["admin.credits.remaining"](),
        cell: (info) => (
          <span className="text-muted-foreground tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("expiresAt", {
        header: () => m["admin.credits.expires_at"](),
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: () => m["admin.credits.created_at"](),
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
    ],
    [],
  );

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  return (
    <div>
      <AdminHeader
        description={m["admin.credits.all_transactions"]()}
        title={m["admin.credits.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.credits.no_transactions_found"]()}
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <DataTable<AdminCreditRow>
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          tableKey="admin.credits"
        />
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
