import { Text } from "react-native";

import { Screen } from "@/components/ui/screen";

export default function SettingsScreen() {
  return (
    <Screen>
      <Text className="text-foreground dark:text-dark-foreground">
        Settings
      </Text>
    </Screen>
  );
}
