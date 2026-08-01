import type { SupportedLocale } from "@openstarter/i18n";
import { SUPPORTED_LOCALES } from "@openstarter/i18n";
import Constants from "expo-constants";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { useAppLocale } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";
import { useThemePreference } from "@/lib/theme";
import { m } from "@/paraglide/messages.js";

const THEME_OPTIONS: readonly ThemePreference[] = ["light", "dark", "system"];

const THEME_LABELS: Record<ThemePreference, () => string> = {
  dark: () => m["common.nav.theme_dark"](),
  light: () => m["common.nav.theme_light"](),
  system: () => m["common.nav.theme_system"](),
};

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  zh: "中文",
};

export default function SettingsScreen() {
  const { preference, setPreference } = useThemePreference();
  const { locale, setAppLocale } = useAppLocale();

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card title={m["mobile.settings.appearance"]()}>
          <View className="gap-2">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                label={THEME_LABELS[option]()}
                onPress={() => setPreference(option)}
                variant={option === preference ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card title={m["common.nav.language"]()}>
          <View className="gap-2">
            {SUPPORTED_LOCALES.map((option) => (
              <Button
                key={option}
                label={LOCALE_LABELS[option]}
                onPress={() => setAppLocale(option)}
                variant={option === locale ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["mobile.settings.version"]()}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {Constants.expoConfig?.version ?? "-"}
            </Text>
          </View>
        </Card>

        <Button
          label={m["common.sign.sign_out_title"]()}
          onPress={() => {
            authClient.signOut().catch(() => undefined);
          }}
          variant="outline"
        />
      </View>
    </Screen>
  );
}
