// apps/web/src/routes/admin/orders.tsx
// 订单管理（R26.2）：分页列表，由通用 DataTable（react-table + react-virtual）渲染。

import { Badge } from "@openstarter/ui-web/components/badge";
import { useQuery } from "@tanstack/react-query";
import { legacyCreateColumnHelper } from "@tanstack/react-table/legacy";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { countTotalPages, listSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { admin, type AdminOrderRow } from "@/modules/admin/lib/api";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.orders(Number(deps.page) || 1)]),
  component: AdminOrdersPage,
});

const columnHelper = legacyCreateColumnHelper<AdminOrderRow>();

function AdminOrdersPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const ordersQuery = useQuery(admin.queries.orders(page));

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  // 列定义 memo 化保持稳定引用；header/cell 用函数在渲染时取当前 locale。
  const columns = useMemo<DataColumn<AdminOrderRow>[]>(
    () => [
      columnHelper.accessor("orderNo", {
        header: () => m["admin.orders.order_col"](),
        cell: (info) => (
          <span className="font-mono text-muted-foreground text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor((row) => row.userEmail ?? row.userId, {
        id: "user",
        header: () => m["admin.orders.user_col"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.productName ?? row.productId ?? "—", {
        id: "product",
        header: () => m["admin.orders.product_col"](),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor(
        (row) => `${(row.amount / 100).toFixed(2)} ${row.currency.toUpperCase()}`,
        {
          id: "amount",
          header: () => m["admin.orders.amount_col"](),
          cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        },
      ),
      columnHelper.accessor("paymentProvider", {
        header: () => m["admin.orders.provider_col"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("status", {
        header: () => m["admin.orders.status_col"](),
        cell: (info) => (
          <Badge variant={info.getValue() === "paid" ? "secondary" : "outline"}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: () => m["admin.orders.created_col"](),
        cell: (info) => (
          <span className="text-muted-foreground">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
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
        description={m["admin.orders.description"]()}
        title={m["admin.orders.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.orders.no_orders"]()}
        error={ordersQuery.error as Error | null}
        loading={ordersQuery.isPending}
      />

      {items.length > 0 ? (
        <DataTable<AdminOrderRow>
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          tableKey="admin.orders"
          virtualized
        />
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
