import { usePaywall } from "@openstarter/billing-mobile";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Text } from "@openstarter/ui-mobile";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useUserPlan, useUserCredits } from "@/lib/queries";
import { runPurchaseConfirmation } from "@/lib/purchase-confirmation";

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const planQuery = useUserPlan();
  const creditsQuery = useUserCredits();
  const [confirming, setConfirming] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);
  const settled = useRef(false);
  const presented = useRef(false);

  /** 服务端是否已反映购买（plan 升级或余额增加均为成功信号）。 */
  const pollServerConfirmation = async (): Promise<boolean> => {
    const [plan, credits] = await Promise.all([
      planQuery
        .refetch()
        .then((q) => q.data)
        .catch(() => null),
      creditsQuery
        .refetch()
        .then((q) => q.data)
        .catch(() => null),
    ]);
    const planUpgraded = plan?.status === "success" && plan.data.plan !== "none";
    const creditsGranted = credits?.status === "success" && credits.data.balance > 0;
    return planUpgraded || creditsGranted;
  };

  /** 购买/恢复成功的统一后处理：有界轮询 + 关闭付费墙（幂等）。 */
  const handlePurchaseSettled = (): void => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    setConfirming(true);
    void runPurchaseConfirmation({ poll: pollServerConfirmation }).then((result) => {
      setConfirming(false);
      if (result.status === "timeout") {
        setPendingNotice(true);
      }
      router.replace("/settings/billing");
    });
  };

  const { present } = usePaywall({
    onPurchase: () => handlePurchaseSettled(),
    onRestore: () => handlePurchaseSettled(),
    onError: () => {
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
    onDismiss: () => {
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
    onSkip: () => {
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
  });

  useEffect(() => {
    if (presented.current) {
      return;
    }
    presented.current = true;
    void present({ trigger: "billing" });
  }, [present]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        {confirming || pendingNotice ? (
          <Text className="text-muted-foreground text-center text-sm dark:text-dark-muted-foreground">
            {t("settings.billing.purchase_processing")}
          </Text>
        ) : null}
        {pendingNotice && !confirming ? (
          <Button onPress={() => router.replace("/settings/billing")} variant="outline">
            <Text>{t("settings.billing.close")}</Text>
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}
