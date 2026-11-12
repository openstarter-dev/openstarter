import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Card, CardContent, Text } from "@openstarter/ui-mobile";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import {
  type OrdersFilter,
  filterOrders,
  formatIsoDate,
  formatMinorAmount,
} from "@/lib/billing-format";
import { authClient } from "@/lib/auth-client";
import { useUserOrders } from "@/lib/queries";

const PAGE_SIZE = 20;

const MIN_TOUCH_TARGET = 44;

export default function OrdersScreen() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const ordersQuery = useUserOrders(page);
  const result = ordersQuery.data;

  useEffect(() => {
    if (result?.status === "unauthorized") {
      authClient.signOut().catch(() => undefined);
    }
  }, [result?.status]);

  if (ordersQuery.isPending || !result) {
    return <Spinner />;
  }

  if (result.status !== "success") {
    const message =
      result.status === "unreachable"
        ? t("common.error.unreachable")
        : result.status === "server-error"
          ? result.message
          : t("common.sign.sign_in_title");
    return (
      <Screen>
        <View className="gap-3 p-6">
          <Text className="text-destructive text-sm dark:text-dark-destructive">{message}</Text>
          <Button
            onPress={() => {
              ordersQuery.refetch().catch(() => undefined);
            }}
            variant="outline"
          >
            <Text>{t("common.error.retry")}</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  const filter: OrdersFilter = "all";
  const visible = filterOrders(result.data.items, filter);
  const total = result.data.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
          {t("common.table.total", { count: total })}
        </Text>

        {visible.length === 0 ? (
          <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {t("settings.payments.no_payments")}
          </Text>
        ) : (
          <Card className="p-4">
            <CardContent className="flex flex-col gap-1 p-0">
              {visible.map((order) => (
                <View className="flex-row items-center justify-between py-1.5" key={order.orderNo}>
                  <View className="flex-1 flex-col">
                    <Text className="text-foreground text-sm dark:text-dark-foreground">
                      {order.productName ?? order.orderNo}
                    </Text>
                    <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                      {formatIsoDate(order.paidAt ?? null) ?? order.status}
                    </Text>
                  </View>
                  <Text className="font-medium text-foreground text-sm dark:text-dark-foreground">
                    {formatMinorAmount(order.amount, order.currency)}
                  </Text>
                </View>
              ))}
            </CardContent>
          </Card>
        )}

        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityLabel={t("common.table.previous")}
            accessibilityRole="button"
            disabled={page <= 1}
            onPress={() => setPage((current) => Math.max(1, current - 1))}
            style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
            className="items-center justify-center rounded-md active:opacity-60"
          >
            <Text
              className={
                page <= 1
                  ? "text-muted-foreground dark:text-dark-muted-foreground"
                  : "text-foreground dark:text-dark-foreground"
              }
            >
              {t("common.table.previous")}
            </Text>
          </Pressable>
          <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {t("common.table.page_info", { current: page, total: totalPages })}
          </Text>
          <Pressable
            accessibilityLabel={t("common.table.next")}
            accessibilityRole="button"
            disabled={page >= totalPages}
            onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
            style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
            className="items-center justify-center rounded-md active:opacity-60"
          >
            <Text
              className={
                page >= totalPages
                  ? "text-muted-foreground dark:text-dark-muted-foreground"
                  : "text-foreground dark:text-dark-foreground"
              }
            >
              {t("common.table.next")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
