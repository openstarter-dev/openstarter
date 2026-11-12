import type { SupportedLocale } from "@openstarter/i18n-mobile";
import { SUPPORTED_LOCALES, useTranslation } from "@openstarter/i18n-mobile";
import { Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import Constants from "expo-constants";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { useAppLocale } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";
import { useThemePreference } from "@/lib/theme";

const THEME_OPTIONS: readonly ThemePreference[] = ["light", "dark", "system"];

const THEME_LABEL_KEYS: Record<ThemePreference, string> = {
  dark: "common.nav.theme_dark",
  light: "common.nav.theme_light",
  system: "common.nav.theme_system",
};

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  zh: "中文",
};

/** MIN 触控热区（Apple HIG / Material 双标准的最小可点面积）。 */
const MIN_TOUCH_TARGET = 44;

/** 一个带 chevron 的入口行：整行可点，44×44 热区，无障碍标签。 */
function EntryRow(props: {
  children?: ReactNode;
  description: string;
  href: string;
  title: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel={props.title}
      accessibilityRole="button"
      onPress={() => router.push(props.href)}
      style={{ minHeight: MIN_TOUCH_TARGET }}
      className="flex-row items-center justify-between py-1 active:opacity-60"
    >
      <View className="flex-1 flex-col gap-0.5">
        <Text className="font-medium text-foreground text-sm dark:text-dark-foreground">
          {props.title}
        </Text>
        <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
          {props.description}
        </Text>
      </View>
      <View
        className="items-center justify-center"
        style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
      >
        {props.children}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();
  const { locale, setAppLocale } = useAppLocale();

  const entries: Array<{ description: string; href: string; title: string }> = [
    {
      description: t("mobile.settings.billing_entry_description"),
      href: "/settings/billing",
      title: t("mobile.settings.billing_entry"),
    },
    {
      description: t("mobile.settings.credits_entry_description"),
      href: "/settings/credits",
      title: t("mobile.settings.credits_entry"),
    },
    {
      description: t("mobile.settings.orders_entry_description"),
      href: "/settings/orders",
      title: t("mobile.settings.orders_entry"),
    },
    {
      description: t("settings.referral.entry_description"),
      href: "/(tabs)/profile/referral",
      title: t("settings.referral.title"),
    },
  ];

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card className="gap-3 p-4">
          <CardTitle>{t("mobile.settings.billing_entries")}</CardTitle>
          <CardContent className="flex flex-col p-0">
            {entries.map((entry) => (
              <EntryRow
                description={entry.description}
                href={entry.href}
                key={entry.href}
                title={entry.title}
              >
                <Ionicons color="#9ca3af" name="chevron-forward" size={20} />
              </EntryRow>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-3 p-4">
          <CardTitle>{t("mobile.settings.appearance")}</CardTitle>
          <CardContent className="flex flex-col gap-2 p-0">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                onPress={() => setPreference(option)}
                variant={option === preference ? "default" : "outline"}
              >
                <Text>{t(THEME_LABEL_KEYS[option])}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-3 p-4">
          <CardTitle>{t("common.nav.language")}</CardTitle>
          <CardContent className="flex flex-col gap-2 p-0">
            {SUPPORTED_LOCALES.map((option) => (
              <Button
                key={option}
                onPress={() => setAppLocale(option)}
                variant={option === locale ? "default" : "outline"}
              >
                <Text>{LOCALE_LABELS[option]}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="flex-row items-center justify-between p-0">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {t("mobile.settings.version")}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {Constants.expoConfig?.version ?? "-"}
            </Text>
          </CardContent>
        </Card>

        <Button
          onPress={() => {
            authClient.signOut().catch(() => undefined);
          }}
          variant="outline"
        >
          <Text>{t("common.sign.sign_out_title")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
