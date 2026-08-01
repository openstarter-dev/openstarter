import { Text } from "react-native";

import { Screen } from "@/components/ui/screen";

export default function ForgotPasswordScreen() {
  return (
    <Screen>
      <Text className="text-foreground dark:text-dark-foreground">
        Forgot password
      </Text>
    </Screen>
  );
}
