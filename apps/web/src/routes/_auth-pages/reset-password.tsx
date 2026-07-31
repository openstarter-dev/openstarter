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

export const Route = createFileRoute("/_auth-pages/reset-password")({
  component: ResetPasswordPage,
  // 令牌与错误标记来自邮件重置链接的 query（R6.2/R6.3）。
  validateSearch: (
    search: Record<string, unknown>
  ): { token?: string; error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
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
        setError("Missing or invalid reset token");
        return;
      }
      const result = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (result.error) {
        setError(result.error.message || "Reset failed");
        return;
      }
      toast.success("Password updated. Please sign in.");
      navigate({ to: "/login" });
    },
    validators: { onSubmit: resetSchema },
  });

  // 令牌缺失或链接错误：拒绝重置并引导重新发起（R6.3）。
  const tokenInvalid = !token || Boolean(linkError);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        {!tokenInvalid && (
          <CardDescription>Choose a new password.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {tokenInvalid ? (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-center text-destructive text-sm">
              This reset link is invalid or has expired.
            </div>
            <Link
              className="block text-center text-sm underline underline-offset-4"
              to="/forgot-password"
            >
              Request a new link
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
                  <Label htmlFor={field.name}>New password</Label>
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
                  <Label htmlFor={field.name}>Confirm new password</Label>
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
                <Button
                  className="w-full"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Updating..." : "Update password"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
