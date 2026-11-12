import { m } from "@openstarter/i18n-web/messages";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import SignInForm from "@/components/auth/sign-in-form";
import SignUpForm from "@/components/auth/sign-up-form";
import { OneTapPrompt } from "@/components/auth/one-tap-prompt";
import { buildPageHead } from "@/lib/page-head";

const DEFAULT_REDIRECT = "/dashboard";

/** 只接受站内相对路径：挡掉 `//evil.com`、绝对 URL 之类的开放重定向。 */
function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

const loginSearchSchema = z.object({
  error: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/_auth-pages/login")({
  validateSearch: loginSearchSchema,
  head: () =>
    buildPageHead({
      title: m["common.sign.sign_in_title"](),
      description: m["common.sign.sign_in_description"](),
      path: "/login",
    }),
  component: LoginPage,
});

function LoginPage() {
  const { error, redirect } = Route.useSearch();
  const [showSignIn, setShowSignIn] = useState(true);
  const redirectTo = safeRedirect(redirect);

  useEffect(() => {
    if (error === "oauth") {
      toast.error(m["common.sign.oauth_failed"]());
    }
  }, [error]);

  return (
    <>
      <OneTapPrompt callbackURL={redirectTo} />
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} redirectTo={redirectTo} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} redirectTo={redirectTo} />
      )}
    </>
  );
}
