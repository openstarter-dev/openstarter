import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import SignInForm from "@/components/auth/sign-in-form";
import SignUpForm from "@/components/auth/sign-up-form";

export const Route = createFileRoute("/_auth-pages/login")({
  // OAuth 失败/取消经 errorCallbackURL 回退至 `/login?error=oauth`（R5.4）。
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const [showSignIn, setShowSignIn] = useState(true);

  useEffect(() => {
    if (error === "oauth") {
      toast.error("Social sign-in failed or was cancelled. Please try again.");
    }
  }, [error]);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
