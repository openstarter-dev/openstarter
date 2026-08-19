// 无密码登录入口(Magic Link / Email OTP):依据 Config 启用集合渲染对应 UI。
//
// - Magic Link:输入邮箱后下发一次性登录链接到该邮箱;用户点击链接即完成登录。
// - Email OTP:输入邮箱后下发一次性验证码到该邮箱;用户在下一屏输入验证码完成登录。
//
// 由 admin 后台的 System Settings 开关 `magic_link_enabled` / `email_otp_enabled` 控制,
// 公共配置端点(`/api/config/public)下发到前端;开关关闭时本组件不渲染对应入口。

import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type PasswordlessMode = "magic-link" | "email-otp";

interface PasswordlessFormProps {
  emailOtpEnabled: boolean;
  magicLinkEnabled: boolean;
}

export function PasswordlessForm({ magicLinkEnabled, emailOtpEnabled }: PasswordlessFormProps) {
  const modes: PasswordlessMode[] = [];
  if (magicLinkEnabled) {
    modes.push("magic-link");
  }
  if (emailOtpEnabled) {
    modes.push("email-otp");
  }

  const [mode, setMode] = useState<PasswordlessMode | null>(modes.at(0) ?? null);
  const [email, setEmail] = useState("");
  const [otpInputMode, setOtpInputMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (modes.length === 0 || mode === null) {
    return null;
  }

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.signIn.magicLink({
      callbackURL: "/dashboard",
      email,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Magic link failed");
      return;
    }
    toast.success("Check your email for the sign-in link");
  };

  const handleEmailOtpRequest = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "OTP request failed");
      return;
    }
    setOtpInputMode(true);
    toast.success("A verification code was sent to your email");
  };

  const handleEmailOtpVerify = async () => {
    if (!otp) {
      toast.error("Please enter the code");
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.signIn.emailOtp({
      callbackURL: "/dashboard",
      email,
      otp,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Verification failed");
      return;
    }
    toast.success("Signed in successfully");
  };

  const submitActionLabel = (() => {
    if (submitting) {
      return "Sending...";
    }
    return mode === "magic-link" ? "Send magic link" : "Send code";
  })();

  return (
    <div className="space-y-4">
      {modes.length > 1 && !otpInputMode ? (
        <div className="flex gap-2">
          {modes.map((modeItem) => (
            <Button
              className="flex-1"
              key={modeItem}
              onClick={() => setMode(modeItem)}
              size="sm"
              type="button"
              variant={mode === modeItem ? "default" : "outline"}
            >
              {modeItem === "magic-link" ? "Magic link" : "Email code"}
            </Button>
          ))}
        </div>
      ) : null}

      {otpInputMode ? (
        <div className="space-y-2">
          <Label htmlFor="passwordless-otp">Enter the code sent to {email}</Label>
          <Input
            id="passwordless-otp"
            inputMode="numeric"
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            value={otp}
          />
          <Button
            className="w-full"
            disabled={submitting}
            onClick={handleEmailOtpVerify}
            type="button"
          >
            {submitting ? "Verifying..." : "Verify"}
          </Button>
          <Button
            className="w-full"
            onClick={() => setOtpInputMode(false)}
            size="sm"
            type="button"
            variant="link"
          >
            Back
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="passwordless-email">Email</Label>
          <Input
            autoComplete="email"
            id="passwordless-email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
          <Button
            className="w-full"
            disabled={submitting}
            onClick={mode === "magic-link" ? handleMagicLink : handleEmailOtpRequest}
            type="button"
          >
            {submitActionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
