import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { getEnv } from "@/lib/env";
import { m } from "@/paraglide/messages.js";

export default function ForgotPasswordScreen() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const env = getEnv();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError("");
      // 重置链接必须落在 Web 端（原生端不实现重置表单），
      // 因此 redirectTo 指向 API 同源的 /reset-password —— 与 apps/web 的行为一致。
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: env.ok ? `${env.apiUrl}/reset-password` : undefined,
      });
      if (result.error) {
        setError(result.error.message ?? "Request failed");
        return;
      }
      // 账户枚举防护：无论邮箱是否存在都展示同一结果。
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
          {m["common.sign.forgot_password_title"]()}
        </Text>

        {sent ? (
          <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {m["common.sign.forgot_password"]()}
          </Text>
        ) : (
          <View className="gap-4">
            <form.Field name="email">
              {(field) => (
                <Input
                  autoComplete="email"
                  errors={field.state.meta.errors.map(
                    (item) => item?.message ?? ""
                  )}
                  label={m["common.sign.email_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.email_placeholder"]()}
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
                  label={m["common.sign.forgot_password_title"]()}
                  loading={isSubmitting}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                />
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
            {m["common.sign.sign_in_title"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
