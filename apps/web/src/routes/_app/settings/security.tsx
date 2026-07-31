// apps/web/src/routes/_app/settings/security.tsx
// 改密码 + 改邮箱两张卡。

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
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/settings/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const { data: session } = authClient.useSession();
  const [changingPassword, setChangingPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);

  const passwordForm = useForm({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      setChangingPassword(true);
      try {
        const result = await authClient.changePassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
          revokeOtherSessions: false,
        });
        if (result.error) {
          toast.error(result.error.message || "Failed to change password");
          return;
        }
        toast.success("Password updated");
        passwordForm.reset();
      } finally {
        setChangingPassword(false);
      }
    },
    validators: {
      onSubmit: z.object({
        confirmPassword: z.string().min(1, "Please confirm the new password"),
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  const emailForm = useForm({
    defaultValues: { newEmail: session?.user?.email ?? "" },
    onSubmit: async ({ value }) => {
      setChangingEmail(true);
      try {
        const result = await authClient.changeEmail({
          newEmail: value.newEmail,
        });
        if (result.error) {
          toast.error(result.error.message || "Failed to change email");
          return;
        }
        toast.success(
          "Email update requested. Check your inbox to confirm the change."
        );
      } finally {
        setChangingEmail(false);
      }
    },
    validators: {
      onSubmit: z.object({
        newEmail: z.email("Invalid email address"),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Use a strong password of at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              passwordForm.handleSubmit();
            }}
          >
            <passwordForm.Field name="currentPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Current password</Label>
                  <Input
                    autoComplete="current-password"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-destructive text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </passwordForm.Field>

            <passwordForm.Field name="newPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>New password</Label>
                  <Input
                    autoComplete="new-password"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-destructive text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </passwordForm.Field>

            <passwordForm.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Confirm new password</Label>
                  <Input
                    autoComplete="new-password"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-destructive text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </passwordForm.Field>

            <Button disabled={changingPassword} type="submit">
              {changingPassword ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change email</CardTitle>
          <CardDescription>
            A confirmation link will be sent to the new address before the
            change takes effect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              emailForm.handleSubmit();
            }}
          >
            <emailForm.Field name="newEmail">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>New email</Label>
                  <Input
                    autoComplete="email"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="email"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-destructive text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </emailForm.Field>

            <Button disabled={changingEmail} type="submit">
              {changingEmail ? "Requesting..." : "Request email change"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
