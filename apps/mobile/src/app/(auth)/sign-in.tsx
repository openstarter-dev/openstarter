import { useForm } from "@tanstack/react-form";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Field, Text } from "@openstarter/ui-mobile";
import z from "zod";

import { PasswordlessForm } from "@/components/auth/passwordless-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { resolveEnabledProviders, resolvePasswordlessModes } from "@/lib/public-config";
import { usePublicConfig } from "@/lib/queries";

const MIN_PASSWORD_LENGTH = 8;

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const configQuery = usePublicConfig();
  const methods = resolveEnabledProviders(configQuery.data ?? {});
  const passwordless = resolvePasswordlessModes(configQuery.data ?? {});
  const hasPasswordless = passwordless.magicLink || passwordless.emailOtp;

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          authClient.sendVerificationEmail({ email: value.email }).catch(() => undefined);
          router.replace({
            pathname: "/verify-email",
            params: { email: value.email },
          });
          return;
        }
        setError(result.error.message ?? "Sign in failed");
      }
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {t("common.sign.sign_in_title")}
        </Text>

        {methods.socialProviders.length > 0 ? (
          <SocialButtons onError={setError} providers={methods.socialProviders} />
        ) : null}

        {methods.socialProviders.length > 0 && methods.emailPassword ? (
          <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {t("common.sign.or")}
          </Text>
        ) : null}

        {methods.emailPassword ? (
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

            <form.Field name="password">
              {(field) => (
                <Field
                  autoComplete="password"
                  errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                  label={t("common.sign.password_title")}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={t("common.sign.password_placeholder")}
                  secureTextEntry
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
                  <Text>{t("common.sign.sign_in_title")}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        {methods.passwordReset ? (
          <Link asChild href="/forgot-password">
            <Text className="text-center text-muted-foreground text-sm underline dark:text-dark-muted-foreground">
              {t("common.sign.forgot_password")}
            </Text>
          </Link>
        ) : null}

        {hasPasswordless ? (
          <PasswordlessForm
            emailOtpEnabled={passwordless.emailOtp}
            magicLinkEnabled={passwordless.magicLink}
          />
        ) : null}

        <Link asChild href="/sign-up">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {t("common.sign.no_account")}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
