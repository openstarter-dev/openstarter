import { useForm } from "@tanstack/react-form";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Field, Text } from "@openstarter/ui-mobile";
import z from "zod";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { bindReferralAfterSignup } from "@/lib/referral-attribution";

const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signUp.email({
        email: value.email,
        name: value.name,
        password: value.password,
      });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          authClient.sendVerificationEmail({ email: value.email }).catch(() => undefined);
          void bindReferralAfterSignup();
          router.replace({
            pathname: "/verify-email",
            params: { email: value.email },
          });
          return;
        }
        setError(result.error.message ?? "Sign up failed");
        return;
      }
      setPendingVerification(true);
      void bindReferralAfterSignup();
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        name: z.string().min(MIN_NAME_LENGTH, "Name is too short"),
        password: z.string().min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {t("common.sign.sign_up_title")}
        </Text>

        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <Field
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={t("common.sign.name_title")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={t("common.sign.name_placeholder")}
                value={field.state.value}
              />
            )}
          </form.Field>

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
                <Text>{t("common.sign.sign_up_title")}</Text>
              </Button>
            )}
          </form.Subscribe>
        </View>

        {pendingVerification ? (
          <View className="gap-2">
            <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
              {t("common.sign.sign_up_description")}
            </Text>
            <Button
              onPress={() => {
                authClient
                  .sendVerificationEmail({ email: form.state.values.email })
                  .catch(() => undefined);
                router.replace({
                  pathname: "/verify-email",
                  params: { email: form.state.values.email },
                });
              }}
              variant="outline"
            >
              <Text>{t("common.sign.resend_verification")}</Text>
            </Button>
          </View>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {t("common.sign.already_have_account")}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
