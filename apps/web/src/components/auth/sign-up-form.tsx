import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstarter/ui-web/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { bindReferralAfterSignup } from "@/lib/referral-attribution";
import { publicConfig } from "@/modules/public-config/lib/api";

import Loader from "../loader";
import { OAuthButtons } from "./oauth-buttons";
import { getEnabledOAuthProviders } from "./oauth-provider-selection";
import { PasswordlessForm, type PasswordlessMode } from "./passwordless-form";

type SignUpMode = "password" | PasswordlessMode;

export default function SignUpForm({
  onSwitchToSignIn,
  redirectTo = "/dashboard",
}: {
  onSwitchToSignIn: () => void;
  /** 注册成功后的目标地址（由 /login?redirect= 校验后下发）。 */
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
  const emailVerificationEnabled = configs.email_verification_enabled === "true";
  const hasSocial = enabledOAuthProviders.length > 0;
  const signUpModes: SignUpMode[] = [
    ...(emailEnabled ? (["password"] as const) : []),
    ...(magicLinkEnabled ? (["magic-link"] as const) : []),
    ...(emailOtpEnabled ? (["email-otp"] as const) : []),
  ];
  const [selectedMode, setSelectedMode] = useState<SignUpMode>("password");
  const activeMode = signUpModes.includes(selectedMode) ? selectedMode : signUpModes[0];

  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          name: value.name,
          password: value.password,
        },
        {
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
          onSuccess: () => {
            if (emailVerificationEnabled) {
              navigate({ search: { email: value.email }, to: "/verify-email" });
              toast.success("Check your email to verify your account");
              return;
            }
            void bindReferralAfterSignup();
            window.location.assign(redirectTo);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        name: z.string().min(2, "Name must be at least 2 characters"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">Create Account</h1>

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

      {hasSocial && signUpModes.length > 0 ? (
        <div className="my-4 flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      {signUpModes.length > 0 ? (
        <Tabs
          className="w-full"
          onValueChange={(value) => setSelectedMode(value as SignUpMode)}
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
                <form.Field name="name">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
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
                      <Label htmlFor={field.name}>Password</Label>
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
                  <Button className="w-full" disabled={!canSubmit || isSubmitting} type="submit">
                    {isSubmitting ? "Submitting..." : "Sign Up"}
                  </Button>
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
          onClick={onSwitchToSignIn}
          type="button"
          variant="link"
        >
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );
}
