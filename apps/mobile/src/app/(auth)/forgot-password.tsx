import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Field, Text } from "@openstarter/ui-mobile";
import z from "zod";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { getEnv } from "@/lib/env";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const env = getEnv();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: env.ok ? `${env.apiUrl}/reset-password` : undefined,
      });
      if (result.error) {
        setError(result.error.message ?? "Request failed");
        return;
      }
      setSent(true);
    },
    validators: {
      onSubmit: z.object({ email: z.email("Invalid email address") }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {t("common.sign.forgot_password_title")}
        </Text>

        {sent ? (
          <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {t("common.sign.forgot_password")}
          </Text>
        ) : (
          <View className="gap-4">
            <form.Field name="email">
              {(field) => (
                <Field
                  autoComplete="email"
                  errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                  label={t("common.sign.email_title")}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={t("common.sign.email_placeholder")}
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
                  <Text>{t("common.sign.forgot_password_title")}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        )}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {t("common.sign.sign_in_title")}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
