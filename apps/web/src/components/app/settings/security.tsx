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
import { m } from "@/paraglide/messages.js";

export function SecurityPage() {
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
        toast.error(m["settings.security.passwords_dont_match"]());
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
          toast.error(result.error.message || m["settings.security.password_update_failed"]());
          return;
        }
        toast.success(m["settings.security.password_updated"]());
        passwordForm.reset();
      } finally {
        setChangingPassword(false);
      }
    },
    validators: {
      onSubmit: z.object({
        confirmPassword: z.string().min(1, m["settings.security.confirm_password_required"]()),
        currentPassword: z.string().min(1, m["settings.security.current_password_required"]()),
        newPassword: z.string().min(8, m["settings.security.password_min_length"]()),
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
          toast.error(result.error.message || m["settings.security.email_change_failed"]());
          return;
        }
        toast.success(m["settings.security.email_change_requested"]());
      } finally {
        setChangingEmail(false);
      }
    },
    validators: {
      onSubmit: z.object({
        newEmail: z.email(m["settings.security.invalid_email"]()),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m["settings.security.change_password_title"]()}</CardTitle>
          <CardDescription>{m["settings.security.change_password_description"]()}</CardDescription>
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
                  <Label htmlFor={field.name}>{m["settings.security.current_password"]()}</Label>
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
                  <Label htmlFor={field.name}>{m["settings.security.new_password"]()}</Label>
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
                  <Label htmlFor={field.name}>
                    {m["settings.security.confirm_new_password"]()}
                  </Label>
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
              {changingPassword
                ? m["settings.security.updating_password"]()
                : m["settings.security.update_password"]()}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m["settings.security.change_email_title"]()}</CardTitle>
          <CardDescription>{m["settings.security.change_email_description"]()}</CardDescription>
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
                  <Label htmlFor={field.name}>{m["settings.security.new_email"]()}</Label>
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
              {changingEmail
                ? m["settings.security.requesting"]()
                : m["settings.security.request_email_change"]()}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
