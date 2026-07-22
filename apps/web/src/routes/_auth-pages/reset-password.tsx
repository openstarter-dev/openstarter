import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { Button } from "@openstarter/ui/components/button";
import { Input } from "@openstarter/ui/components/input";
import { Label } from "@openstarter/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth-pages/reset-password")({
  // 令牌与错误标记来自邮件重置链接的 query（R6.2/R6.3）。
  validateSearch: (
    search: Record<string, unknown>
  ): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ResetPasswordPage,
});

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate({ from: "/reset-password" });
  const [error, setError] = useState("");

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
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
              to="/forgot-password"
              className="block text-center text-sm underline underline-offset-4"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>New password</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-red-500 text-sm">
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
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((err) => (
                    <p key={err?.message} className="text-red-500 text-sm">
                      {err?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="w-full" disabled={isSubmitting}>
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
