// 分销屏：推荐码 + 统计卡片 + 佣金流水（filter tabs + list）。
// 模式照抄 settings/credits.tsx：Screen + Card + Text + filter tabs + useQuery。
import { useTranslation } from "@openstarter/i18n-mobile";
import { useQuery } from "@tanstack/react-query";
import { Clipboard, Pressable, Share, View } from "react-native";
import { useState } from "react";

import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";
import { apiClient } from "@/lib/api";

const PAGE_SIZE = 20;

type CommissionFilter = "all" | "pending" | "settled" | "void";

const FILTERS: readonly CommissionFilter[] = ["all", "pending", "settled", "void"];

const FILTER_LABEL_KEYS: Record<CommissionFilter, string> = {
  all: "settings.referral.tab_all",
  pending: "settings.referral.tab_pending",
  settled: "settings.referral.tab_settled",
  void: "settings.referral.tab_void",
};

const COMMISSION_STATUS_LABEL: Record<string, string> = {
  pending: "settings.referral.status_pending",
  settled: "settings.referral.status_settled",
  void: "settings.referral.status_void",
};

const MIN_TOUCH_TARGET = 44;

/** 佣金状态页签（44×44 触控热区）。 */
function FilterTabs(props: {
  active: CommissionFilter;
  onSelect: (filter: CommissionFilter) => void;
  t: (key: string) => string;
}) {
  return (
    <View className="flex-row gap-2">
      {FILTERS.map((filter) => (
        <Pressable
          key={filter}
          accessibilityRole="tab"
          accessibilityState={{ selected: props.active === filter }}
          onPress={() => props.onSelect(filter)}
          style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
          className={`flex-1 items-center justify-center rounded-md px-2 active:opacity-60 ${props.active === filter ? "font-semibold text-foreground text-sm dark:text-dark-foreground" : "text-muted-foreground text-sm dark:text-dark-muted-foreground"}`}
        >
          <Text>{props.t(FILTER_LABEL_KEYS[filter])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReferralScreen() {
  const { t } = useTranslation();

  const meQuery = useQuery({
    queryFn: async () => {
      const res = await apiClient.api.referral.me.$get();
      if (!res.ok) throw new Error("Failed to load referral info");
      return (await res.json()).data;
    },
    queryKey: ["referral", "me"],
  });

  const [commissionsPage, setCommissionsPage] = useState(1);
  const commissionsQuery = useQuery({
    queryFn: async () => {
      const res = await apiClient.api.referral.commissions.$get({
        query: { page: String(commissionsPage), pageSize: String(PAGE_SIZE) },
      });
      if (!res.ok) throw new Error("Failed to load commissions");
      return (await res.json()).data;
    },
    queryKey: ["referral", "commissions", commissionsPage],
  });

  const [filter, setFilter] = useState<CommissionFilter>("all");

  if (meQuery.isPending || commissionsQuery.isPending) {
    return <Spinner />;
  }

  if (!meQuery.data) {
    return (
      <Screen>
        <View className="gap-3 p-6">
          <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {t("settings.referral.title")}
          </Text>
        </View>
      </Screen>
    );
  }

  const me = meQuery.data;
  const commissions = commissionsQuery.data?.items ?? [];
  const commissionsTotal = commissionsQuery.data?.total ?? 0;
  const filtered =
    filter === "all" ? commissions : commissions.filter((item) => item.status === filter);

  const handleCopy = async () => {
    if (!me.link) return;
    Clipboard.setString(me.link);
  };

  const handleShare = async () => {
    if (!me.link) return;
    try {
      await Share.share({ message: me.link });
    } catch {
      // 分享取消/不可用：静默
    }
  };

  return (
    <Screen>
      <View className="gap-4 p-6">
        {/* 统计卡片 */}
        <View className="flex-row gap-3">
          <Card className="flex-1 gap-1 p-4">
            <CardContent className="p-0">
              <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                {t("settings.referral.stats_referred")}
              </Text>
              <Text className="font-semibold text-foreground text-2xl dark:text-dark-foreground">
                {me.stats.referredCount}
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1 gap-1 p-4">
            <CardContent className="p-0">
              <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                {t("settings.referral.stats_total")}
              </Text>
              <Text className="font-semibold text-foreground text-2xl dark:text-dark-foreground">
                {me.stats.totalCredits}
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1 gap-1 p-4">
            <CardContent className="p-0">
              <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                {t("settings.referral.stats_pending")}
              </Text>
              <Text className="font-semibold text-foreground text-2xl dark:text-dark-foreground">
                {me.stats.pendingCredits}
              </Text>
            </CardContent>
          </Card>
        </View>

        {/* 推荐码 + 链接 + 操作按钮 */}
        <Card className="gap-3 p-4">
          <CardTitle>{t("settings.referral.code_label")}</CardTitle>
          <CardContent className="flex flex-col gap-2 p-0">
            <Text className="font-mono text-lg font-bold text-foreground dark:text-dark-foreground">
              {me.code}
            </Text>
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {t("settings.referral.link_label")}
            </Text>
            <Text className="font-mono text-sm text-foreground dark:text-dark-foreground">
              {me.link}
            </Text>
            <View className="flex-row gap-2 mt-2">
              <Button onPress={handleCopy} variant="secondary" className="flex-1">
                <Text>{t("settings.referral.copy")}</Text>
              </Button>
              <Button onPress={handleShare} variant="outline" className="flex-1">
                <Text>{t("settings.referral.share")}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* 佣金流水 */}
        <Card className="p-4">
          <CardTitle>{t("settings.referral.commissions_title")}</CardTitle>
          <CardContent className="flex flex-col gap-1 p-0 mt-2">
            <FilterTabs active={filter} onSelect={setFilter} t={t} />
            {filtered.length === 0 ? (
              <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground py-3">
                {t("settings.referral.no_records")}
              </Text>
            ) : (
              filtered.map(
                (item: {
                  id: string;
                  status: string;
                  commissionCredits: number;
                  createdAt: string;
                }) => (
                  <View className="flex-row items-center justify-between py-1.5" key={item.id}>
                    <View className="flex-1 flex-col">
                      <Text className="text-foreground text-sm dark:text-dark-foreground">
                        {t(COMMISSION_STATUS_LABEL[item.status] ?? item.status)}
                      </Text>
                      <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                        {item.createdAt}
                      </Text>
                    </View>
                    <Text
                      className={
                        item.status === "settled"
                          ? "font-medium text-sm text-success dark:text-dark-success"
                          : item.status === "void"
                            ? "font-medium text-sm text-destructive dark:text-dark-destructive"
                            : "font-medium text-sm text-muted-foreground dark:text-dark-muted-foreground"
                      }
                    >
                      {item.commissionCredits}
                    </Text>
                  </View>
                ),
              )
            )}
            {commissionsTotal > 0 && (
              <View className="flex-row justify-end gap-2 mt-3">
                <Button
                  disabled={commissionsPage <= 1}
                  onPress={() => setCommissionsPage((p) => p - 1)}
                  variant="outline"
                >
                  <Text>{t("common.prev")}</Text>
                </Button>
                <Button
                  disabled={commissionsPage * PAGE_SIZE >= commissionsTotal}
                  onPress={() => setCommissionsPage((p) => p + 1)}
                  variant="outline"
                >
                  <Text>{t("common.next")}</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
