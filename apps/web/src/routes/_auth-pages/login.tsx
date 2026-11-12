import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import SignInForm from "@/components/auth/sign-in-form";
import SignUpForm from "@/components/auth/sign-up-form";
import { OneTapPrompt } from "@/components/auth/one-tap-prompt";
import { buildPageHead } from "@/lib/page-head";
import { m } from "@/paraglide/messages.js";

const DEFAULT_REDIRECT = "/dashboard";

/** 只接受站内相对路径：挡掉 `//evil.com`、绝对 URL 之类的开放重定向。 */
function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

export const Route = createFileRoute("/_auth-pages/login")({
  // OAuth 失败/取消经 errorCallbackURL 回退至 `/login?error=oauth`（R5.4）。
  // `redirect` 由受保护路由的守卫写入（登录后回跳到原目标）。
  validateSearch: (search: Record<string, unknown>): { error?: string; redirect?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
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
      {/* Google One Tap：依公开配置渲染（未开启时为 no-op）。 */}
      <OneTapPrompt callbackURL={redirectTo} />
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} redirectTo={redirectTo} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} redirectTo={redirectTo} />
      )}
    </>
  );
}
