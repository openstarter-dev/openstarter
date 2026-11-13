import { m } from "@openstarter/i18n-web/messages";
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

const VIRTUAL_ROW_ESTIMATE = 48;
const VIRTUAL_OVERSCAN = 10;
const VIRTUAL_CONTAINER_HEIGHT = 560;

export type DataColumn<TData extends RowData> = LegacyColumnDef<TData, any>;

export interface DataTableProps<TData extends RowData> {
  columns: DataColumn<TData>[];
  data: TData[];
  tableKey: string;
  getRowId?: (row: TData) => string;
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
