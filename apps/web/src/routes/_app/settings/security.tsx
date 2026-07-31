// apps/web/src/routes/_app/settings/security.tsx
// 改密码 + 改邮箱两张卡。

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
import { toast } from "sonner";
import { useState } from "react";
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
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
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
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(1, "Please confirm the new password"),
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
          "Email update requested. Check your inbox to confirm the change.",
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
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              passwordForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <passwordForm.Field name="currentPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Current password</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-destructive text-sm">
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
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-destructive text-sm">
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
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-destructive text-sm">
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </passwordForm.Field>

            <Button type="submit" disabled={changingPassword}>
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
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              emailForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <emailForm.Field name="newEmail">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>New email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-destructive text-sm">
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </emailForm.Field>

            <Button type="submit" disabled={changingEmail}>
              {changingEmail ? "Requesting..." : "Request email change"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
