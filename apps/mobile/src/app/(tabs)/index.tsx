import { Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";

export default function HomeScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground dark:text-dark-foreground">Home</Text>
      </View>
    </Screen>
  );
}
