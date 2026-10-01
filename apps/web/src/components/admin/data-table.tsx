// 管理后台通用数据表（react-table legacy + react-virtual + react-store 组合）。
//
// 用 react-table（v9 的 v8 兼容入口 `useLegacyTable`）做无头表格：列定义、列
// 可见性由 react-table 管理；列可见性偏好经 react-store 跨组件共享并持久化到
// localStorage（见 column-visibility.ts）；`virtualized` 开启时用 react-virtual
// 对行做虚拟滚动，适用于长列表（订单/积分流水）。
//
// 消费侧只负责「列定义 + 数据」，统一渲染 shadcn Table，消除各列表页重复表格。

import { Button } from "@openstarter/ui-web/components/button";
import { Checkbox } from "@openstarter/ui-web/components/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@openstarter/ui-web/components/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { getCoreRowModel, useLegacyTable } from "@tanstack/react-table/legacy";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import type { RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import {
  restoreColumnVisibility,
  setColumnVisibility,
  useColumnVisibility,
} from "@/components/admin/column-visibility";
import { m } from "@/paraglide/messages.js";

/** 虚拟滚动估算行高（px）；翻页/多行时虚拟化会重算。 */
const VIRTUAL_ROW_ESTIMATE = 48;
const VIRTUAL_OVERSCAN = 10;
/** 虚拟滚动容器高度；超长列表在此高度内滚动渲染。 */
const VIRTUAL_CONTAINER_HEIGHT = 560;

/**
 * 列定义类型：TValue 用 `any` 吸收 accessor 列各自的具体取值类型，使具体类型的
 * accessor 列能赋给统一数组（react-table v9 legacy 的 ColumnDef TValue 逆变）。
 */
export type DataColumn<TData extends RowData> = LegacyColumnDef<TData, any>;

export interface DataTableProps<TData extends RowData> {
  /** react-table 列定义（经 legacyCreateColumnHelper 构造，类型安全）。 */
  columns: DataColumn<TData>[];
  /** 当前页数据；应保持稳定引用（调用方 useMemo/useQuery 数据）。 */
  data: TData[];
  /** 列可见性偏好唯一键（跨路由共享、localStorage 持久化）。 */
  tableKey: string;
  /** 稳定行 id 工厂（默认用行索引）。 */
  getRowId?: (row: TData) => string;
  /** 开启行虚拟滚动（react-virtual），适合长列表。 */
  virtualized?: boolean;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  tableKey,
  getRowId,
  virtualized = false,
}: DataTableProps<TData>) {
  const columnVisibility = useColumnVisibility(tableKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 挂载后从 localStorage 恢复本表偏好（SSR 首渲染保持一致，见 column-visibility.ts）。
  useEffect(() => {
    restoreColumnVisibility(tableKey);
  }, [tableKey]);

  const table = useLegacyTable({
    columns,
    data,
    getRowId: getRowId ? (row) => getRowId(row as TData) : undefined,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(tableKey, next);
    },
  });

  const rows = table.getRowModel().rows;
  const visibleLeafColumns = table.getAllLeafColumns().filter((col) => col.getIsVisible());

  const virtualizer = useVirtualizer({
    count: virtualized ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE,
    overscan: VIRTUAL_OVERSCAN,
  });

  const headerRows = table.getHeaderGroups();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" type="button" variant="outline">
              {m["admin.table.columns"]()}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="space-y-2">
              <p className="font-medium text-sm">{m["admin.table.columns"]()}</p>
              {table.getAllLeafColumns().map((column) => (
                <label className="flex items-center gap-2 text-sm" key={column.id}>
                  <Checkbox
                    aria-label={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={column.getToggleVisibilityHandler()}
                  />
                  <span>{column.id}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        className="rounded-lg border"
        ref={virtualized ? scrollRef : undefined}
        style={virtualized ? { height: VIRTUAL_CONTAINER_HEIGHT, overflow: "auto" } : undefined}
      >
        <Table>
          <TableHeader>
            {headerRows.map((headerGroup) => (
              <TableRow
                className={virtualized ? "sticky top-0 bg-background z-10" : undefined}
                key={headerGroup.id}
              >
                {headerGroup.headers
                  .filter((header) => header.column.getIsVisible())
                  .map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : table.FlexRender({ header })}
                    </TableHead>
                  ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            style={
              virtualized
                ? { height: `${virtualizer.getTotalSize()}px`, position: "relative" }
                : undefined
            }
          >
            {virtualized
              ? virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{table.FlexRender({ cell })}</TableCell>
                      ))}
                    </TableRow>
                  );
                })
              : rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{table.FlexRender({ cell })}</TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {visibleLeafColumns.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m["admin.table.no_visible_columns"]()}</p>
      ) : null}
    </div>
  );
}
