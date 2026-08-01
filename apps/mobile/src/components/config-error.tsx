import { Text, View } from "react-native";

import { m } from "@/paraglide/messages.js";

import { Screen } from "./ui/screen";

export function ConfigError(props: { reason: string }) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Text className="font-semibold text-base text-destructive dark:text-dark-destructive">
          {m["common.error.misconfigured"]()}
        </Text>
        <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
          {props.reason}
        </Text>
      </View>
    </Screen>
  );
}
