import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { Link, type LinkComponentProps, type RegisteredRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type PaginationTo = NonNullable<
  LinkComponentProps<"a", RegisteredRouter, string, string>["to"]
>;

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

function PaginationLink({
  children,
  disabled,
  page,
  to,
}: {
  children: ReactNode;
  disabled: boolean;
  page: number;
  to: PaginationTo;
}) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link
        aria-disabled={disabled}
        className={disabled ? "pointer-events-none opacity-50" : undefined}
        search={(prev: Record<string, unknown>) => ({ ...prev, page })}
        tabIndex={disabled ? -1 : undefined}
        to={to}
      >
        {children}
      </Link>
    </Button>
  );
}

export function Pagination({
  page,
  totalPages,
  to,
}: {
  page: number;
  to: PaginationTo;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-muted-foreground text-sm">
        {m["common.table.page_info"]({ current: String(page), total: String(totalPages) })}
      </span>
      <div className="flex gap-2">
        <PaginationLink disabled={page <= 1} page={Math.max(1, page - 1)} to={to}>
          {m["common.table.previous"]()}
        </PaginationLink>
        <PaginationLink disabled={page >= totalPages} page={Math.min(totalPages, page + 1)} to={to}>
          {m["common.table.next"]()}
        </PaginationLink>
      </div>
    </div>
  );
}

export function StatusText({
  loading,
  error,
  empty,
  emptyLabel = m["common.no_records_found"](),
}: {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">{m["admin.loading"]()}</p>;
  }
  if (error) {
    return <p className="text-destructive text-sm">{error.message}</p>;
  }
  if (empty) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return null;
}
