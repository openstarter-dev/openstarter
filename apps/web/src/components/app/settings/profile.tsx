import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { m } from "@openstarter/i18n-web/messages";

export function ProfilePage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    defaultValues: { name: user?.name ?? "" },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        const result = await authClient.updateUser({ name: value.name });
        if (result.error) {
          toast.error(result.error.message || m["common.profile.update_failed"]());
          return;
        }
        toast.success(m["common.profile.updated"]());
      } finally {
        setSubmitting(false);
      }
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .min(1, m["common.profile.name_required"]())
          .max(100, m["common.profile.name_too_long"]()),
      }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["settings.profile.profile"]()}</CardTitle>
        <CardDescription>{m["settings.profile.description"]()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{m["settings.profile.display_name"]()}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                {field.state.meta.errors.map((err) => (
                  <p className="text-destructive text-sm" key={err?.message}>
                    {err?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button disabled={isSubmitting || submitting} type="submit">
                {submitting ? m["settings.profile.saving"]() : m["settings.profile.save"]()}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
