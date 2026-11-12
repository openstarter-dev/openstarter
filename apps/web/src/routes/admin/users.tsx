// apps/web/src/routes/admin/users.tsx
// 用户管理（R26.2）：分页列表 + 邮箱搜索（@tanstack/pacer Debouncer 防抖）。

import { m } from "@openstarter/i18n-web/messages";
import { Badge } from "@openstarter/ui-web/components/badge";
import { Input } from "@openstarter/ui-web/components/input";
import { useQuery } from "@tanstack/react-query";
import { Debouncer } from "@tanstack/pacer";
import { legacyCreateColumnHelper } from "@tanstack/react-table/legacy";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { countTotalPages, listUsersSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { admin, type AdminUserRow } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/users")({
  validateSearch: listUsersSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [
    admin.queries.users(Number(deps.page) || 1, String(deps.q ?? "")),
  ]),
  component: AdminUsersPage,
});

const columnHelper = legacyCreateColumnHelper<AdminUserRow>();

const SEARCH_DEBOUNCE_MS = 300;

function AdminUsersPage() {
  const { page, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(q ?? "");

  // URL 里的 q（如浏览器前进/后退、分享链接）反向同步输入框。
  useEffect(() => {
    setSearchInput(q ?? "");
  }, [q]);

  // 用最新 navigate（ref）供 pacer 回调闭包使用；在 effect 里更新 ref，
  // 避免渲染期间读写 ref.current（react(refs) 规则）。
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  // @tanstack/pacer：把「输入变化 → 导航到 URL」的副作用做 300ms 防抖，
  // 替代手写 useEffect + setTimeout（同一副作用，pacer 管理计时与执行）。
  const debouncer = useMemo(
    () =>
      new Debouncer(
        (value: string) => {
          void navigateRef.current({
            search: (prev) => ({ ...prev, page: 1, q: value || undefined }),
            replace: true,
          });
        },
        { wait: SEARCH_DEBOUNCE_MS },
      ),
    [],
  );

  // 组件卸载时取消未触发的防抖，避免离开路由后残留一次「拉回列表」的导航（H1）。
  useEffect(() => () => debouncer.cancel(), [debouncer]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncer.maybeExecute(value);
  };

  const usersQuery = useQuery(admin.queries.users(page, q));

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const columns = useMemo<DataColumn<AdminUserRow>[]>(
    () => [
      columnHelper.accessor("name", {
        header: () => m["admin.users.name_col"](),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("email", {
        header: () => m["admin.users.email_col_label"](),
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("emailVerified", {
        header: () => m["admin.users.verified_col"](),
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="secondary">{m["common.verified"]()}</Badge>
          ) : (
            <Badge variant="outline">{m["common.unverified"]()}</Badge>
          ),
      }),
      columnHelper.accessor("createdAt", {
        header: () => m["admin.users.created_col"](),
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
        description={m["admin.users.all_registered"]()}
        title={m["admin.users.title"]()}
      />
      <div className="mb-4 max-w-xs">
        <Input
          aria-label={m["admin.users.search_placeholder"]()}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={m["admin.users.search_placeholder"]()}
          type="search"
          value={searchInput}
        />
      </div>

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.users.no_users_found"]()}
        error={usersQuery.error as Error | null}
        loading={usersQuery.isPending}
      />

      {items.length > 0 ? (
        <DataTable<AdminUserRow>
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          tableKey="admin.users"
        />
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
