import { Text, View } from "react-native";

export function Badge(props: { label: string }) {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-1 dark:bg-dark-secondary">
      <Text className="font-medium text-secondary-foreground text-xs dark:text-dark-secondary-foreground">
        {props.label}
      </Text>
    </View>
  );
}
