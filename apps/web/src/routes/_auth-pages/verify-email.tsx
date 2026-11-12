import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { buildPageHead } from "@/lib/page-head";

const verifyEmailSearchSchema = z.object({
  callbackUrl: z.string().startsWith("/").optional().catch(undefined),
  email: z.string().optional(),
});

export const Route = createFileRoute("/_auth-pages/verify-email")({
  head: () =>
    buildPageHead({
      title: m["common.sign.verify_email_page_title"](),
      description: m["common.sign.verify_email_page_description"](),
      path: "/verify-email",
    }),
  component: VerifyEmailPage,
  validateSearch: verifyEmailSearchSchema,
});

function VerifyEmailPage() {
  const { email, callbackUrl } = Route.useSearch();
  const navigate = useNavigate({ from: "/verify-email" });
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const nextUrl = callbackUrl ?? "/dashboard";

  const handleResend = async () => {
    if (!email) {
      toast.error(m["common.sign.verify_email_email_required"]());
      return;
    }
    setSending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        callbackURL: nextUrl,
        email,
      });
      if (result.error) {
        toast.error(result.error.message || m["common.sign.verify_email_send_failed"]());
        return;
      }
      toast.success(m["common.sign.verification_email_sent"]());
    } finally {
      setSending(false);
    }
  };

  const handleContinue = async () => {
    setChecking(true);
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error(m["common.sign.verify_email_not_verified_yet"]());
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["common.sign.verify_email_page_title"]()}</CardTitle>
        <CardDescription>
          {email
            ? m["common.sign.verify_email_sent_to"]({ email })
            : m["common.sign.verify_email_sent_generic"]()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <Button
            className="w-full"
            disabled={sending}
            onClick={() => {
              handleResend().catch(() => {
                toast.error(m["common.sign.verify_email_send_failed"]());
              });
            }}
            type="button"
            variant="outline"
          >
            {sending ? m["common.sign.sending"]() : m["common.sign.resend_verification"]()}
          </Button>
          <Button
            className="w-full"
            disabled={checking}
            onClick={() => {
              handleContinue().catch(() => {
                toast.error(m["common.sign.verify_email_check_failed"]());
              });
            }}
            type="button"
          >
            {checking ? m["common.sign.checking"]() : m["common.sign.verify_email_continue"]()}
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Link
          className="w-full text-center text-muted-foreground text-xs underline underline-offset-4"
          to="/login"
        >
          {m["common.sign.back_to_sign_in"]()}
        </Link>
      </CardFooter>
    </Card>
  );
}
