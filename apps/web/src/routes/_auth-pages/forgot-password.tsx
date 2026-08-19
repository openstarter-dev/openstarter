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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth-pages/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError("");
      // 重置链接指向前端 /reset-password（携带令牌）。
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo,
      });
      if (result.error) {
        setError(result.error.message || "Request failed");
        return;
      }
      // 账户枚举防护（R6.6）：无论邮箱是否存在均展示一致的通用结果。
      setSent(true);
    },
    validators: {
      onSubmit: z.object({ email: z.email("Invalid email address") }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sent ? "Check your email" : "Forgot password"}</CardTitle>
        {!sent && (
          <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              If an account exists for that email, a password reset link is on its way.
            </p>
            <Link className="block text-center text-sm underline underline-offset-4" to="/login">
              Back to sign in
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
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="email"
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
                  {isSubmitting ? "Sending..." : "Send reset link"}
                </Button>
              )}
            </form.Subscribe>
            <Link className="block text-center text-sm underline underline-offset-4" to="/login">
              Back to sign in
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
