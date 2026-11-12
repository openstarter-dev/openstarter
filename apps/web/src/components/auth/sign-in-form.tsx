import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstarter/ui-web/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { publicConfig } from "@/modules/public-config/lib/api";

import Loader from "../loader";
import { AnonymousButton } from "./anonymous-button";
import { OAuthButtons } from "./oauth-buttons";
import { getEnabledOAuthProviders } from "./oauth-provider-selection";
import { PasskeyButton } from "./passkey-button";
import { PasswordlessForm, type PasswordlessMode } from "./passwordless-form";

type SignInMode = "password" | PasswordlessMode;

export default function SignInForm({
  onSwitchToSignUp,
  redirectTo = "/dashboard",
}: {
  onSwitchToSignUp: () => void;
  /** 登录成功后的目标地址（由 /login?redirect= 校验后下发）。 */
  redirectTo?: string;
}) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();

  const configQuery = useQuery(publicConfig.queries.get());
  const configs = configQuery.data ?? {};
  const emailEnabled = configs.email_auth_enabled !== "false";
  const enabledOAuthProviders = getEnabledOAuthProviders(configs);
  const googleEnabled = enabledOAuthProviders.includes("google");
  const githubEnabled = enabledOAuthProviders.includes("github");
  const appleEnabled = enabledOAuthProviders.includes("apple");
  const magicLinkEnabled = configs.magic_link_enabled === "true";
  const emailOtpEnabled = configs.email_otp_enabled === "true";
  const passwordResetEnabled = configs.password_reset_enabled === "true";
  const anonymousEnabled = configs.anonymous_auth_enabled === "true";
  const hasSocial = enabledOAuthProviders.length > 0;
  const signInModes: SignInMode[] = [
    ...(emailEnabled ? (["password"] as const) : []),
    ...(magicLinkEnabled ? (["magic-link"] as const) : []),
    ...(emailOtpEnabled ? (["email-otp"] as const) : []),
  ];
  const [selectedMode, setSelectedMode] = useState<SignInMode>("password");
  const activeMode = signInModes.includes(selectedMode) ? selectedMode : signInModes[0];

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onError: (error) => {
            if (error.error.code === "EMAIL_NOT_VERIFIED") {
              authClient.sendVerificationEmail({ email: value.email }).catch(() => undefined);
              navigate({ search: { email: value.email }, to: "/verify-email" });
              return;
            }
            toast.error(error.error.message || error.error.statusText);
          },
          onSuccess: () => {
            // 整页跳转：目标可能是任意站内路径（含查询串），同时让 auth store 以新会话重载。
            window.location.assign(redirectTo);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

      {hasSocial && (
        <div className="mb-4">
          <OAuthButtons
            appleEnabled={appleEnabled}
            callbackURL={redirectTo}
            githubEnabled={githubEnabled}
            googleEnabled={googleEnabled}
          />
        </div>
      )}

      <div className="mb-4">
        <PasskeyButton callbackURL={redirectTo} />
      </div>

      {hasSocial && signInModes.length > 0 ? (
        <div className="my-4 flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      {signInModes.length > 0 ? (
        <Tabs
          className="w-full"
          onValueChange={(value) => setSelectedMode(value as SignInMode)}
          value={activeMode}
        >
          <TabsList className="w-full">
            {emailEnabled ? <TabsTrigger value="password">Password</TabsTrigger> : null}
            {magicLinkEnabled ? <TabsTrigger value="magic-link">Magic link</TabsTrigger> : null}
            {emailOtpEnabled ? <TabsTrigger value="email-otp">OTP</TabsTrigger> : null}
          </TabsList>

          <TabsContent className="mt-4" value="password">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <div>
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
                      {field.state.meta.errors.map((error) => (
                        <p className="text-red-500" key={error?.message}>
                          {error?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>
              </div>

              <div>
                <form.Field name="password">
                  {(field) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>Password</Label>
                        {passwordResetEnabled && (
                          <Link
                            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
                            to="/forgot-password"
                          >
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <Input
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="password"
                        value={field.state.value}
                      />
                      {field.state.meta.errors.map((error) => (
                        <p className="text-red-500" key={error?.message}>
                          {error?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <>
                    <Button className="w-full" disabled={!canSubmit || isSubmitting} type="submit">
                      {isSubmitting ? "Submitting..." : "Sign In"}
                    </Button>
                    {anonymousEnabled ? <AnonymousButton /> : null}
                  </>
                )}
              </form.Subscribe>
            </form>
          </TabsContent>

          <TabsContent className="mt-4" value="magic-link">
            <PasswordlessForm
              callbackURL={redirectTo}
              emailOtpEnabled={emailOtpEnabled}
              magicLinkEnabled={magicLinkEnabled}
              mode="magic-link"
            />
          </TabsContent>

          <TabsContent className="mt-4" value="email-otp">
            <PasswordlessForm
              callbackURL={redirectTo}
              emailOtpEnabled={emailOtpEnabled}
              magicLinkEnabled={magicLinkEnabled}
              mode="email-otp"
            />
          </TabsContent>
        </Tabs>
      ) : null}

      <div className="mt-4 text-center">
        <Button
          className="text-indigo-600 hover:text-indigo-800"
          onClick={onSwitchToSignUp}
          type="button"
          variant="link"
        >
          Need an account? Sign Up
        </Button>
      </div>
    </div>
  );
}
