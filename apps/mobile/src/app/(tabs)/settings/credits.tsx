import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";
import { Pressable, View } from "react-native";
import { useEffect, useState } from "react";

import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { type CreditsFilter, filterCreditHistory, formatIsoDate } from "@/lib/billing-format";
import { authClient } from "@/lib/auth-client";
import { useUserCredits } from "@/lib/queries";

const FILTERS: readonly CreditsFilter[] = ["all", "grant", "consume"];

const FILTER_LABEL_KEYS: Record<CreditsFilter, string> = {
  all: "settings.credits.tab_all",
  consume: "settings.credits.tab_consume",
  grant: "settings.credits.tab_grant",
};

const MIN_TOUCH_TARGET = 44;

/** 页签按钮行（44×44 热区）。 */
function FilterTabs(props: {
  active: CreditsFilter;
  onSelect: (filter: CreditsFilter) => void;
  t: (key: string) => string;
}) {
  return (
    <View className="flex-row gap-2">
      {FILTERS.map((filter) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: props.active === filter }}
          onPress={() => props.onSelect(filter)}
          style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
          className="flex-1 items-center justify-center rounded-md px-2 active:opacity-60"
          key={filter}
        >
          <Text
            className={
              props.active === filter
                ? "font-semibold text-foreground text-sm dark:text-dark-foreground"
                : "text-muted-foreground text-sm dark:text-dark-muted-foreground"
            }
          >
            {props.t(FILTER_LABEL_KEYS[filter])}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CreditsScreen() {
  const { t } = useTranslation();
  const creditsQuery = useUserCredits();
  const [filter, setFilter] = useState<CreditsFilter>("all");
  const result = creditsQuery.data;

  useEffect(() => {
    if (result?.status === "unauthorized") {
      authClient.signOut().catch(() => undefined);
    }
  }, [result?.status]);

  if (creditsQuery.isPending || !result) {
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
              creditsQuery.refetch().catch(() => undefined);
            }}
            variant="outline"
          >
            <Text>{t("common.error.retry")}</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  const visible = filterCreditHistory(result.data.history, filter);

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card className="gap-2 p-4">
          <CardTitle>{t("settings.credits.balance")}</CardTitle>
          <CardContent className="p-0">
            <Text className="font-semibold text-foreground text-3xl dark:text-dark-foreground">
              {result.data.balance.toLocaleString()}
            </Text>
          </CardContent>
        </Card>

        <FilterTabs active={filter} onSelect={setFilter} t={t} />

        {visible.length === 0 ? (
          <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {t("settings.credits.no_records")}
          </Text>
        ) : (
          <Card className="p-4">
            <CardContent className="flex flex-col gap-1 p-0">
              {visible.map((item) => {
                const expires = formatIsoDate(item.expiresAt ?? null);
                return (
                  <View
                    className="flex-row items-center justify-between py-1.5"
                    key={item.transactionNo}
                  >
                    <View className="flex-1 flex-col">
                      <Text className="text-foreground text-sm dark:text-dark-foreground">
                        {item.description ?? item.transactionNo}
                      </Text>
                      {expires ? (
                        <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                          {t("settings.credits.expires_at")}: {expires}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      className={
                        item.credits >= 0
                          ? "font-medium text-sm text-success dark:text-dark-success"
                          : "font-medium text-destructive text-sm dark:text-dark-destructive"
                      }
                    >
                      {item.credits >= 0 ? "+" : ""}
                      {item.credits.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </CardContent>
          </Card>
        )}
      </View>
    </Screen>
  );
}
