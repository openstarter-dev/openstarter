import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

const MIN_NAME_LENGTH = 2;

export default function ProfileScreen() {
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
        <Card title={m["common.nav.profile"]()}>
          <View className="gap-1">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["settings.profile.email"]()}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {session?.user.email ?? ""}
            </Text>
          </View>

          <form.Field name="name">
            {(field) => (
              <Input
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["settings.profile.name"]()}
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
                disabled={!canSubmit}
                label={isSubmitting ? m["settings.profile.saving"]() : m["settings.profile.save"]()}
                loading={isSubmitting}
                onPress={() => {
                  form.handleSubmit();
                }}
              />
            )}
          </form.Subscribe>

          {saved ? (
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["settings.profile.saved"]()}
            </Text>
          ) : null}

          {error.length > 0 ? (
            <Text className="text-destructive text-sm dark:text-dark-destructive">{error}</Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
