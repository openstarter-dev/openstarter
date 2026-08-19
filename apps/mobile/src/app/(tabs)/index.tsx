import { useEffect } from "react";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useUserPlan } from "@/lib/queries";
import { m } from "@/paraglide/messages.js";

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const planQuery = useUserPlan();
  const result = planQuery.data;

  // 401 = 未登录，而不是错误：清掉会话，门禁随即把人送回登录页（spec §7 第 2 条）。
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
            {m["mobile.home.greeting"]()}
          </Text>
          <Text className="font-semibold text-foreground text-lg dark:text-dark-foreground">
            {session?.user.email ?? ""}
          </Text>
        </View>

        <Card title={m["settings.overview.plan"]()}>
          {result.status === "success" ? <Badge label={result.data.plan} /> : null}

          {result.status === "unreachable" ? (
            <View className="gap-3">
              <Text className="text-destructive text-sm dark:text-dark-destructive">
                {m["common.error.unreachable"]()}
              </Text>
              <Button
                label={m["common.error.retry"]()}
                onPress={() => {
                  planQuery.refetch().catch(() => undefined);
                }}
                variant="outline"
              />
            </View>
          ) : null}

          {result.status === "server-error" ? (
            <View className="gap-3">
              <Text className="text-destructive text-sm dark:text-dark-destructive">
                {result.message}
              </Text>
              <Button
                label={m["common.error.retry"]()}
                onPress={() => {
                  planQuery.refetch().catch(() => undefined);
                }}
                variant="outline"
              />
            </View>
          ) : null}

          {result.status === "unauthorized" ? (
            <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
              {m["common.sign.sign_in_title"]()}
            </Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
