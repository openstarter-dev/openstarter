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

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth-pages/verify-email")({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>): { email?: string; callbackUrl?: string } => ({
    callbackUrl: typeof search.callbackUrl === "string" ? search.callbackUrl : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
});

function VerifyEmailPage() {
  const { email, callbackUrl } = Route.useSearch();
  const navigate = useNavigate({ from: "/verify-email" });
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const nextUrl = callbackUrl ?? "/dashboard";

  const handleResend = async () => {
    if (!email) {
      toast.error("Missing email address");
      return;
    }
    setSending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        callbackURL: nextUrl,
        email,
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to send verification email");
        return;
      }
      toast.success("Verification email sent");
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
      toast.error("Email not verified yet. Check your inbox.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link{email ? ` to ${email}` : ""}. Click it to activate your
          account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <Button
            className="w-full"
            disabled={sending}
            onClick={() => {
              handleResend().catch(() => {
                toast.error("Failed to send verification email");
              });
            }}
            type="button"
            variant="outline"
          >
            {sending ? "Sending..." : "Resend verification email"}
          </Button>
          <Button
            className="w-full"
            disabled={checking}
            onClick={() => {
              handleContinue().catch(() => {
                toast.error("Failed to check verification status");
              });
            }}
            type="button"
          >
            {checking ? "Checking..." : "I've verified, continue"}
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Link
          className="w-full text-center text-muted-foreground text-xs underline underline-offset-4"
          to="/login"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
