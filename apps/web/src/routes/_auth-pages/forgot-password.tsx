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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { buildPageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_auth-pages/forgot-password")({
  head: () =>
    buildPageHead({
      title: m["common.sign.forgot_password_title"](),
      description: m["common.sign.forgot_password_description"](),
      path: "/forgot-password",
    }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo,
      });
      if (result.error) {
        setError(result.error.message || m["common.sign.password_reset_request_failed"]());
        return;
      }
      setSent(true);
    },
    validators: {
      onSubmit: z.object({ email: z.email("Invalid email address") }),
    },
  });

  const submittedEmail = form.state.values.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {sent
            ? m["common.sign.reset_link_sent_title"]()
            : m["common.sign.forgot_password_title"]()}
        </CardTitle>
        {!sent && <CardDescription>{m["common.sign.forgot_password_description"]()}</CardDescription>}
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {m["common.sign.reset_link_sent_description"]({ email: submittedEmail })}
            </p>
            <Link className="block text-center text-sm underline underline-offset-4" to="/login">
              {m["common.sign.back_to_sign_in"]()}
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
                  <Label htmlFor={field.name}>{m["common.sign.email_title"]()}</Label>
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
                  {isSubmitting ? m["common.sign.sending"]() : m["common.sign.send_reset_link"]()}
                </Button>
              )}
            </form.Subscribe>
            <Link className="block text-center text-sm underline underline-offset-4" to="/login">
              {m["common.sign.back_to_sign_in"]()}
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
