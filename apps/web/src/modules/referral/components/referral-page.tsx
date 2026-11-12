// 分销面板：推荐码/链接 + 统计卡片 + 佣金流水 + 下线列表。
import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { Card } from "@openstarter/ui-web/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { referral } from "@/modules/referral/lib/api";

const QR_SIZE = 120;

export function ReferralPage() {
  const meQuery = useQuery(referral.queries.me());
  const me = meQuery.data;

  const [commissionsPage, setCommissionsPage] = useState(1);
  const commissionsQuery = useQuery(referral.queries.commissions(commissionsPage));
  const commissionsData = commissionsQuery.data;
  const commissionsItems = commissionsData?.items ?? [];
  const commissionsTotal = commissionsData?.total ?? 0;

  const [relationsPage, setRelationsPage] = useState(1);
  const relationsQuery = useQuery(referral.queries.relations(relationsPage));
  const relationsData = relationsQuery.data;
  const relationsItems = relationsData?.items ?? [];
  const relationsTotal = relationsData?.total ?? 0;

  const copyLink = async () => {
    if (!me?.link) return;
    await navigator.clipboard.writeText(me.link);
    toast.success(m["referral_copy_success"]());
  };

  if (!me) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{m["referral_title"]()}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{m["referral_title"]()}</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-sm">{m["referral_stats_referred"]()}</p>
          <p className="text-2xl font-bold">{me.stats.referredCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-sm">{m["referral_stats_total"]()}</p>
          <p className="text-2xl font-bold">{me.stats.totalCredits}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-sm">{m["referral_stats_pending"]()}</p>
          <p className="text-2xl font-bold">{me.stats.pendingCredits}</p>
        </Card>
      </div>

      {/* 推荐码 + 链接 + 二维码 */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-muted-foreground text-sm">{m["referral_code_label"]()}</p>
            <p className="font-mono text-lg font-bold">{me.code}</p>
            <p className="text-muted-foreground text-sm">{m["referral_link_label"]()}</p>
            <p className="font-mono text-sm">{me.link}</p>
            <Button className="mt-2" onClick={copyLink} variant="secondary">
              {m["referral_copy"]()}
            </Button>
          </div>
          <QRCodeSVG size={QR_SIZE} value={me.link} title="Referral QR" />
        </div>
      </Card>

      {/* 佣金流水 */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{m["referral_commissions_title"]()}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m["referral_status_pending"]()}</TableHead>
              <TableHead>{m["referral_status_settled"]()}</TableHead>
              <TableHead>{m["referral_status_void"]()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissionsItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.status === "pending" ? item.commissionCredits : "-"}</TableCell>
                <TableCell>{item.status === "settled" ? item.commissionCredits : "-"}</TableCell>
                <TableCell>{item.status === "void" ? item.commissionCredits : "-"}</TableCell>
                <TableCell>{item.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {commissionsTotal > 0 && (
          <div className="mt-4 flex justify-end gap-2">
            <Button
              disabled={commissionsPage <= 1}
              onClick={() => setCommissionsPage((p) => p - 1)}
              variant="outline"
            >
              Prev
            </Button>
            <Button
              disabled={commissionsPage * 20 >= commissionsTotal}
              onClick={() => setCommissionsPage((p) => p + 1)}
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* 我的邀请 */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{m["referral_relations_title"]()}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relationsItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.referrerId}</TableCell>
                <TableCell>{item.code}</TableCell>
                <TableCell>{item.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {relationsTotal > 0 && (
          <div className="mt-4 flex justify-end gap-2">
            <Button
              disabled={relationsPage <= 1}
              onClick={() => setRelationsPage((p) => p - 1)}
              variant="outline"
            >
              Prev
            </Button>
            <Button
              disabled={relationsPage * 20 >= relationsTotal}
              onClick={() => setRelationsPage((p) => p + 1)}
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
