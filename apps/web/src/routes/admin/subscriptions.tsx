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
import { admin, type AdminSubscriptionRow } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/subscriptions")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.subscriptions(Number(deps.page) || 1)]),
  component: AdminSubscriptionsPage,
});

const columnHelper = legacyCreateColumnHelper<AdminSubscriptionRow>();

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function AdminSubscriptionsPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = useQuery(admin.queries.subscriptions(page));

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const columns = useMemo<DataColumn<AdminSubscriptionRow>[]>(
    () => [
      columnHelper.accessor((row) => row.userEmail ?? row.userId, {
        id: "user",
        header: () => m["admin.subscriptions.user"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.planName ?? row.productName ?? "—", {
        id: "plan",
        header: () => m["admin.subscriptions.plan_col"](),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("paymentProvider", {
        header: () => m["admin.subscriptions.provider"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("status", {
        header: () => m["admin.subscriptions.status"](),
        cell: (info) => (
          <Badge variant={info.getValue() === "active" ? "secondary" : "outline"}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("currentPeriodEnd", {
        header: () => m["admin.subscriptions.period_end_col"](),
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
        description={m["admin.subscriptions.all_subscriptions_desc"]()}
        title={m["admin.subscriptions.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.subscriptions.no_subscriptions_found"]()}
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <DataTable<AdminSubscriptionRow>
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          tableKey="admin.subscriptions"
        />
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
