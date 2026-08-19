// apps/web/src/components/admin/list.tsx
// 管理后台通用列表脚手架：页头（标题/描述/操作区）与分页控件。供各实体管理页复用（R26.2）。

import { Button } from "@openstarter/ui-web/components/button";
import type { ReactNode } from "react";

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-row items-start justify-between gap-4">
      <div>
        <h1 className="font-bold text-2xl">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatusText({
  loading,
  error,
  empty,
  emptyLabel = "No records found.",
}: {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }
  if (error) {
    return <p className="text-destructive text-sm">{error.message}</p>;
  }
  if (empty) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return null;
}
