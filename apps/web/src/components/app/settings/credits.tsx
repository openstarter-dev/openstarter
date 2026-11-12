import { m } from "@openstarter/i18n-web/messages";
import { Badge } from "@openstarter/ui-web/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { legacyCreateColumnHelper } from "@tanstack/react-table/legacy";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { user, type CreditHistoryRow } from "@/modules/user/lib/api";

const columnHelper = legacyCreateColumnHelper<CreditHistoryRow>();

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

export function CreditsPage() {
  const creditsQuery = useQuery(user.queries.credits());

  const balance = creditsQuery.data?.balance ?? 0;
  const history = creditsQuery.data?.history ?? [];

  const columns = useMemo<DataColumn<CreditHistoryRow>[]>(
    () => [
      columnHelper.accessor("transactionType", {
        header: () => m["settings.credits.type"](),
        cell: (info) => (
          <Badge variant={info.getValue() === "grant" ? "secondary" : "outline"}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("credits", {
        header: () => m["settings.credits.credits"](),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("remainingCredits", {
        header: () => m["settings.credits.remaining"](),
        cell: (info) => (
          <span className="text-muted-foreground tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("expiresAt", {
        header: () => m["settings.credits.expires_at"](),
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: () => m["settings.credits.date"](),
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m["settings.credits.title"]()}</CardTitle>
          <CardDescription>{m["settings.credits.description"]()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">{m["settings.credits.balance"]()}</p>
            <p className="font-bold text-3xl tabular-nums">
              {creditsQuery.isPending ? "—" : balance.toLocaleString()}
            </p>
          </div>

          {creditsQuery.error ? (
            <p className="text-destructive text-sm">{(creditsQuery.error as Error).message}</p>
          ) : null}

          {history.length > 0 ? (
            <DataTable<CreditHistoryRow>
              columns={columns}
              data={history}
              getRowId={(row) => row.id}
              tableKey="settings.credits"
              virtualized
            />
          ) : null}

          {history.length === 0 && !creditsQuery.isPending ? (
            <p className="text-muted-foreground text-sm">{m["settings.credits.no_records"]()}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
