import { m } from "@openstarter/i18n-web/messages";
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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { buildPageHead } from "@/lib/page-head";

const resetPasswordSearchSchema = z.object({
  error: z.string().optional(),
  token: z.string().optional(),
});

export const Route = createFileRoute("/_auth-pages/reset-password")({
  head: () =>
    buildPageHead({
      title: m["common.sign.reset_password_title"](),
      description: m["common.sign.reset_password_description"](),
      path: "/reset-password",
    }),
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearchSchema,
});

const resetSchema = z
  .object({
    confirmPassword: z.string().min(8),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate({ from: "/reset-password" });
  const [error, setError] = useState("");

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      if (!token) {
        setError(m["common.sign.reset_password_missing_token"]());
        return;
      }
      const result = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (result.error) {
        setError(result.error.message || m["common.sign.reset_password_failed"]());
        return;
      }
      toast.success(m["common.sign.reset_password_success"]());
      navigate({ to: "/login" });
    },
    validators: { onSubmit: resetSchema },
  });

  const tokenInvalid = !token || Boolean(linkError);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["common.sign.reset_password_title"]()}</CardTitle>
        {!tokenInvalid && (
          <CardDescription>{m["common.sign.reset_password_description"]()}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {tokenInvalid ? (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-center text-destructive text-sm">
              {m["common.sign.reset_password_invalid_token"]()}
            </div>
            <Link
              className="block text-center text-sm underline underline-offset-4"
              to="/forgot-password"
            >
              {m["common.sign.request_new_link"]()}
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            {error ? (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            ) : null}
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{m["common.sign.new_password_title"]()}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-red-500 text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    {m["common.sign.confirm_new_password_title"]()}
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p className="text-red-500 text-sm" key={err?.message}>
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? m["common.sign.updating"]()
                    : m["common.sign.reset_password_submit"]()}
                </Button>
              )}
            </form.Subscribe>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
