// OAuth 登录入口按钮（R5.3/R5.4）：依据 Config 启用集合展示 Google / GitHub / Apple 按钮。
// 失败或用户取消时，better-auth 依 errorCallbackURL 重定向回登录页并由登录页展示可读提示。

import { Button } from "@openstarter/ui-web/components/button";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

// OAuth 失败/取消时的回退地址（登录页据 `?error` 展示可读提示）。
const OAUTH_ERROR_REDIRECT = "/login?error=oauth";

interface OAuthButtonsProps {
  appleEnabled: boolean;
  callbackURL?: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
}

export function OAuthButtons({
  appleEnabled,
  googleEnabled,
  githubEnabled,
  callbackURL = "/dashboard",
}: OAuthButtonsProps) {
  if (!(appleEnabled || googleEnabled || githubEnabled)) {
    return null;
  }

  const handleSocial = (provider: "google" | "github" | "apple") => {
    authClient.signIn
      .social({ callbackURL, errorCallbackURL: OAUTH_ERROR_REDIRECT, provider })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "OAuth sign-in failed");
      });
  };

  return (
    <div className="flex flex-col gap-2">
      {googleEnabled ? (
        <Button
          className="w-full"
          onClick={() => handleSocial("google")}
          type="button"
          variant="outline"
        >
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
            <title>Google</title>
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          Continue with Google
        </Button>
      ) : null}
      {githubEnabled ? (
        <Button
          className="w-full"
          onClick={() => handleSocial("github")}
          type="button"
          variant="outline"
        >
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
            <title>GitHub</title>
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              fill="currentColor"
            />
          </svg>
          Continue with GitHub
        </Button>
      ) : null}
      {appleEnabled ? (
        <Button
          className="w-full"
          onClick={() => handleSocial("apple")}
          type="button"
          variant="outline"
        >
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
            <title>Apple</title>
            <path
              d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.82 0-2.07-.92-3.41-.89-1.75.03-3.38 1.02-4.28 2.59-1.83 3.17-.47 7.86 1.31 10.43.87 1.26 1.91 2.67 3.27 2.62 1.32-.05 1.82-.85 3.41-.85 1.58 0 2.04.85 3.42.82 1.41-.02 2.31-1.28 3.17-2.55 1-1.47 1.41-2.9 1.43-2.97-.03-.01-2.74-1.05-2.77-4.16M14.6 4.95c.72-.87 1.21-2.08 1.08-3.29-1.04.04-2.31.7-3.06 1.57-.67.77-1.26 2-1.1 3.18 1.16.09 2.36-.59 3.08-1.46"
              fill="currentColor"
            />
          </svg>
          Continue with Apple
        </Button>
      ) : null}
    </div>
  );
}
