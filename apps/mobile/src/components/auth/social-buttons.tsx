import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Text } from "@openstarter/ui-mobile";
import { View } from "react-native";

import { authClient } from "@/lib/auth-client";
import type { MobileSocialProvider } from "@/lib/public-config";

const LABEL_KEYS: Record<MobileSocialProvider, string> = {
  apple: "common.sign.apple_sign_in",
  google: "common.sign.google_sign_in",
};

export function SocialButtons(props: {
  providers: MobileSocialProvider[];
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();

  const handlePress = (provider: MobileSocialProvider) => {
    authClient.signIn.social({ callbackURL: "/", provider }).catch((error: unknown) => {
      props.onError(error instanceof Error ? error.message : "OAuth sign-in failed");
    });
  };

  return (
    <View className="gap-2">
      {props.providers.map((provider) => (
        <Button key={provider} onPress={() => handlePress(provider)} variant="outline">
          <Text>{t(LABEL_KEYS[provider])}</Text>
        </Button>
      ))}
    </View>
  );
}
