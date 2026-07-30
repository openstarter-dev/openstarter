// apps/web/src/routes/_app/settings/profile.tsx
// 编辑用户昵称（头像延后到后续阶段，留 TODO 注释）。

import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { Input } from "@openstarter/ui/components/input";
import { Label } from "@openstarter/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
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
          toast.error(result.error.message || "Failed to update profile");
          return;
        }
        toast.success("Profile updated");
      } finally {
        setSubmitting(false);
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name too long"),
      }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your display name visible across the app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* TODO: avatar upload (Phase ?, requires file storage) */}

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
                <Label htmlFor={field.name}>Display name</Label>
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
                {submitting ? "Saving..." : "Save"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
