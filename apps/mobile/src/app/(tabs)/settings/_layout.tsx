import { Stack } from "expo-router";
import { useTranslation } from "@openstarter/i18n-mobile";

export default function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="billing"
        options={{ headerShown: true, title: t("settings.billing.title") }}
      />
      <Stack.Screen
        name="credits"
        options={{ headerShown: true, title: t("settings.credits.title") }}
      />
      <Stack.Screen
        name="orders"
        options={{ headerShown: true, title: t("settings.payments.title") }}
      />
      <Stack.Screen
        name="paywall"
        options={{ headerShown: false, title: t("settings.billing.upgrade") }}
      />
    </Stack>
  );
}
