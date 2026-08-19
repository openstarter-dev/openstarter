import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

export default function SignUpScreen() {
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
        setError(result.error.message ?? "Sign up failed");
        return;
      }
      // 服务端可能要求邮箱验证（REQUIRE_EMAIL_VERIFICATION）。此时不会立即产生会话，
      // 门禁也就不会跳转，因此给出明确提示而不是让人盯着不动的界面。
      setPendingVerification(true);
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
          {m["common.sign.sign_up_title"]()}
        </Text>

        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <Input
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["common.sign.name_title"]()}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={m["common.sign.name_placeholder"]()}
                value={field.state.value}
              />
            )}
          </form.Field>

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
                label={m["common.sign.sign_up_title"]()}
                loading={isSubmitting}
                onPress={() => {
                  form.handleSubmit();
                }}
              />
            )}
          </form.Subscribe>
        </View>

        {pendingVerification ? (
          <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {m["common.sign.sign_up_description"]()}
          </Text>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {m["common.sign.already_have_account"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
