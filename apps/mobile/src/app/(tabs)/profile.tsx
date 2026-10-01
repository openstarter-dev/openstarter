import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Card, CardContent, CardTitle, Field, Text } from "@openstarter/ui-mobile";
import z from "zod";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";

const MIN_NAME_LENGTH = 2;

/** 分销入口行。 */
function ReferralEntryRow() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Button onPress={() => router.push("/(tabs)/profile/referral")} variant="outline">
      <Text>{t("settings.referral.title")}</Text>
    </Button>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const form = useForm({
    defaultValues: { name: session?.user.name ?? "" },
    onSubmit: async ({ value }) => {
      setError("");
      setSaved(false);
      const result = await authClient.updateUser({ name: value.name });
      if (result.error) {
        setError(result.error.message ?? "Update failed");
        return;
      }
      setSaved(true);
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(MIN_NAME_LENGTH, "Name is too short"),
      }),
    },
  });

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card className="gap-3 p-4">
          <CardTitle>{t("common.nav.profile")}</CardTitle>
          <CardContent className="flex flex-col gap-3 p-0">
            <View className="gap-1">
              <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                {t("settings.profile.email")}
              </Text>
              <Text className="text-foreground text-sm dark:text-dark-foreground">
                {session?.user.email ?? ""}
              </Text>
            </View>

            <form.Field name="name">
              {(field) => (
                <Field
                  autoComplete="name"
                  errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                  label={t("settings.profile.name")}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  disabled={!canSubmit || isSubmitting}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                >
                  <Text>
                    {isSubmitting ? t("settings.profile.saving") : t("settings.profile.save")}
                  </Text>
                </Button>
              )}
            </form.Subscribe>

            {saved ? (
              <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
                {t("settings.profile.saved")}
              </Text>
            ) : null}

            {error.length > 0 ? (
              <Text className="text-destructive text-sm dark:text-dark-destructive">{error}</Text>
            ) : null}
          </CardContent>
        </Card>

        <ReferralEntryRow />
      </View>
    </Screen>
  );
}
