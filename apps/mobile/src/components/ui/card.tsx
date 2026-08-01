import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function Card(props: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4 dark:border-dark-border dark:bg-dark-card">
      {props.title ? (
        <Text className="font-semibold text-base text-card-foreground dark:text-dark-card-foreground">
          {props.title}
        </Text>
      ) : null}
      {props.children}
    </View>
  );
}
