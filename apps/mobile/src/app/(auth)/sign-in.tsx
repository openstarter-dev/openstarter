import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { resolveEnabledProviders } from "@/lib/public-config";
import { usePublicConfig } from "@/lib/queries";
import { m } from "@/paraglide/messages.js";

const MIN_PASSWORD_LENGTH = 8;

export default function SignInScreen() {
  const [error, setError] = useState("");
  const configQuery = usePublicConfig();
  const methods = resolveEnabledProviders(configQuery.data ?? {});

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
      }
      // 成功后不手动跳转：(auth)/_layout.tsx 的门禁会因会话变化把人带到 "/"。
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
          {m["common.sign.sign_in_title"]()}
        </Text>

        {methods.socialProviders.length > 0 ? (
          <SocialButtons onError={setError} providers={methods.socialProviders} />
        ) : null}

        {methods.socialProviders.length > 0 && methods.emailPassword ? (
          <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {m["common.sign.or"]()}
          </Text>
        ) : null}

        {methods.emailPassword ? (
          <View className="gap-4">
            <form.Field name="email">
              {(field) => (
                <Input
                  autoComplete="email"
                  errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                  label={m["common.sign.email_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.email_placeholder"]()}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Input
                  autoComplete="password"
                  errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                  label={m["common.sign.password_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.password_placeholder"]()}
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
                  disabled={!canSubmit}
                  label={m["common.sign.sign_in_title"]()}
                  loading={isSubmitting}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                />
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
              {m["common.sign.forgot_password"]()}
            </Text>
          </Link>
        ) : null}

        <Link asChild href="/sign-up">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {m["common.sign.no_account"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
