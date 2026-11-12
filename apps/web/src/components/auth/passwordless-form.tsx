// 无密码登录入口(Magic Link / Email OTP):依据 Config 启用集合渲染对应 UI。
//
// - Magic Link:输入邮箱后下发一次性登录链接到该邮箱;用户点击链接即完成登录。
// - Email OTP:输入邮箱后下发一次性验证码到该邮箱;用户在下一屏输入验证码完成登录。
//
// 由 admin 后台的 System Settings 开关 `magic_link_enabled` / `email_otp_enabled` 控制,
// 公共配置端点(`/api/config/public)下发到前端;开关关闭时本组件不渲染对应入口。

import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export type PasswordlessMode = "magic-link" | "email-otp";

interface PasswordlessFormProps {
  /** 登录成功后的回跳地址（默认 /dashboard）。 */
  callbackURL?: string;
  emailOtpEnabled: boolean;
  magicLinkEnabled: boolean;
  mode?: PasswordlessMode;
}

export function PasswordlessForm({
  callbackURL = "/dashboard",
  magicLinkEnabled,
  emailOtpEnabled,
  mode: selectedMode,
}: PasswordlessFormProps) {
  const modes: PasswordlessMode[] = [];
  if (magicLinkEnabled) {
    modes.push("magic-link");
  }
  if (emailOtpEnabled) {
    modes.push("email-otp");
  }

  const [internalMode, setInternalMode] = useState<PasswordlessMode | null>(modes.at(0) ?? null);
  const [email, setEmail] = useState("");
  const [otpInputMode, setOtpInputMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mode = selectedMode ?? internalMode;

  if (modes.length === 0 || mode === null) {
    return null;
  }

  const handleMagicLink = async () => {
    if (!email) {
      toast.error(m["common.sign.enter_email"]());
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.signIn.magicLink({
      callbackURL,
      email,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? m["common.sign.magic_link_failed"]());
      return;
    }
    toast.success(m["common.sign.magic_link_sent"]());
  };

  const handleEmailOtpRequest = async () => {
    if (!email) {
      toast.error(m["common.sign.enter_email"]());
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? m["common.sign.otp_request_failed"]());
      return;
    }
    setOtpInputMode(true);
    toast.success(m["common.sign.otp_sent"]());
  };

  const handleEmailOtpVerify = async () => {
    if (!otp) {
      toast.error(m["common.sign.otp_required"]());
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.signIn.emailOtp({
      callbackURL,
      email,
      otp,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? m["common.sign.otp_verify_failed"]());
      return;
    }
    toast.success(m["common.sign.signed_in"]());
  };

  const submitActionLabel = (() => {
    if (submitting) {
      return m["common.sign.sending"]();
    }
    return mode === "magic-link"
      ? m["common.sign.send_magic_link"]()
      : m["common.sign.send_code"]();
  })();

  return (
    <div className="space-y-4">
      {selectedMode === undefined && modes.length > 1 && !otpInputMode ? (
        <div className="flex gap-2">
          {modes.map((modeItem) => (
            <Button
              className="flex-1"
              key={modeItem}
              onClick={() => setInternalMode(modeItem)}
              size="sm"
              type="button"
              variant={mode === modeItem ? "default" : "outline"}
            >
              {modeItem === "magic-link"
                ? m["common.sign.magic_link"]()
                : m["common.sign.email_code"]()}
            </Button>
          ))}
        </div>
      ) : null}

      {otpInputMode ? (
        <div className="space-y-2">
          <Label htmlFor="passwordless-otp">{m["common.sign.otp_code_label"]({ email })}</Label>
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
            {submitting ? m["common.sign.verifying"]() : m["common.sign.verify"]()}
          </Button>
          <Button
            className="w-full"
            onClick={() => setOtpInputMode(false)}
            size="sm"
            type="button"
            variant="link"
          >
            {m["common.sign.back"]()}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="passwordless-email">{m["common.sign.email_title"]()}</Label>
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
