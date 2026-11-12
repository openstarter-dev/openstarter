import { useEffect } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Badge, Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";

import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useUserPlan } from "@/lib/queries";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const planQuery = useUserPlan();
  const result = planQuery.data;

  useEffect(() => {
    if (result?.status === "unauthorized") {
      authClient.signOut().catch(() => undefined);
    }
  }, [result?.status]);

  if (planQuery.isPending || !result) {
    return <Spinner />;
  }

  return (
    <Screen>
      <View className="gap-4 p-6">
        <View className="gap-1">
          <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {t("mobile.home.greeting")}
          </Text>
          <Text className="font-semibold text-foreground text-lg dark:text-dark-foreground">
            {session?.user.email ?? ""}
          </Text>
        </View>

        <Card className="gap-3 p-4">
          <CardTitle>{t("settings.overview.plan")}</CardTitle>
          <CardContent className="flex flex-col gap-3 p-0">
            {result.status === "success" ? (
              <Badge variant="secondary">
                <Text>{result.data.plan}</Text>
              </Badge>
            ) : null}

            {result.status === "unreachable" ? (
              <View className="gap-3">
                <Text className="text-destructive text-sm dark:text-dark-destructive">
                  {t("common.error.unreachable")}
                </Text>
                <Button
                  onPress={() => {
                    planQuery.refetch().catch(() => undefined);
                  }}
                  variant="outline"
                >
                  <Text>{t("common.error.retry")}</Text>
                </Button>
              </View>
            ) : null}

            {result.status === "server-error" ? (
              <View className="gap-3">
                <Text className="text-destructive text-sm dark:text-dark-destructive">
                  {result.message}
                </Text>
                <Button
                  onPress={() => {
                    planQuery.refetch().catch(() => undefined);
                  }}
                  variant="outline"
                >
                  <Text>{t("common.error.retry")}</Text>
                </Button>
              </View>
            ) : null}

            {result.status === "unauthorized" ? (
              <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
                {t("common.sign.sign_in_title")}
              </Text>
            ) : null}
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
