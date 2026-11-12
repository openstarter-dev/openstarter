import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { countTotalPages, LIST_PAGE_SIZE } from "@/lib/list-search";
import { user } from "@/modules/user/lib/api";
import { m } from "@openstarter/i18n-web/messages";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

function formatAmount(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2);
  return `${value} ${currency.toUpperCase()}`;
}

function statusVariant(status: string): "secondary" | "outline" {
  return status === "paid" ? "secondary" : "outline";
}

/**
 * 支付记录列表。分页状态可注入（路由页把 page 提升进 URL）；
 * 未注入时退化为本地 useState（ManageAccountDialog 弹窗内复用，无独立 URL）。
 */
export function PaymentsPage({
  onPageChange,
  page: pageProp,
}: {
  onPageChange?: (page: number) => void;
  page?: number;
} = {}) {
  const [localPage, setLocalPage] = useState(1);
  const page = pageProp ?? localPage;
  const goToPage = onPageChange ?? setLocalPage;

  const ordersQuery = useQuery(user.queries.orders(page));

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["settings.payments.title"]()}</CardTitle>
        <CardDescription>{m["settings.payments.description"]()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ordersQuery.error ? (
          <p className="text-destructive text-sm">{(ordersQuery.error as Error).message}</p>
        ) : null}

        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m["settings.payments.order_no"]()}</TableHead>
                  <TableHead>{m["settings.payments.product"]()}</TableHead>
                  <TableHead>{m["settings.payments.amount"]()}</TableHead>
                  <TableHead>{m["settings.payments.provider"]()}</TableHead>
                  <TableHead>{m["settings.payments.status"]()}</TableHead>
                  <TableHead>{m["settings.payments.date"]()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {item.orderNo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName ?? item.productId ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(item.amount, item.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.paymentProvider}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
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

        {items.length === 0 && !ordersQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{m["settings.payments.no_payments"]()}</p>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {m["common.table.page_info"]({ current: String(page), total: String(totalPages) })}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => goToPage(Math.max(1, page - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                {m["common.table.previous"]()}
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                {m["common.table.next"]()}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
