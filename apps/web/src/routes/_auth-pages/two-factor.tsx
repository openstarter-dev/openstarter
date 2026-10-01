// 二步验证（2FA）验证页：登录后若用户开启 2FA，better-auth 的 twoFactorClient fetch
// 插件会把 `twoFactorRedirect` 响应转成本插件的 onTwoFactorRedirect 回调（见
// lib/auth-client 注入的跳转），落到本页。会话凭证此时在 2FA 临时 cookie 中，须先
// 通过 TOTP 或备用码验证才建立正式会话。

import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { buildPageHead } from "@/lib/page-head";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_auth-pages/two-factor")({
  ssr: false,
  head: () =>
    buildPageHead({
      title: m["common.sign.two_factor_title"](),
      description: m["common.sign.two_factor_description"](),
      path: "/two-factor",
    }),
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const navigate = useNavigate({ from: "/two-factor" });
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finish = () => {
    void navigate({ to: "/dashboard" });
    toast.success(m["common.sign.two_factor_success"]());
  };

  const handleVerifyTotp = async () => {
    if (!code.trim()) {
      toast.error(m["common.sign.two_factor_code_required"]());
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result?.error) {
        toast.error(result.error.message ?? m["common.sign.two_factor_failed"]());
        return;
      }
      finish();
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (!code.trim()) {
      toast.error(m["common.sign.two_factor_backup_required"]());
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.twoFactor.verifyBackupCode({ code });
      if (result?.error) {
        toast.error(result.error.message ?? m["common.sign.two_factor_failed"]());
        return;
      }
      finish();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-center font-bold text-3xl">{m["common.sign.two_factor_title"]()}</h1>
      <p className="mb-6 text-center text-muted-foreground text-sm">
        {m["common.sign.two_factor_description"]()}
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="two-factor-code">{m["common.sign.two_factor_code_label"]()}</Label>
          <Input
            autoComplete="one-time-code"
            id="two-factor-code"
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value)}
            placeholder={m["common.sign.two_factor_code_placeholder"]()}
            value={code}
          />
        </div>
        <Button className="w-full" disabled={submitting} onClick={handleVerifyTotp} type="button">
          {submitting
            ? m["common.sign.two_factor_verifying"]()
            : m["common.sign.two_factor_verify"]()}
        </Button>
        <Button
          className="w-full"
          disabled={submitting}
          onClick={handleVerifyBackupCode}
          size="sm"
          type="button"
          variant="link"
        >
          {m["common.sign.two_factor_backup_link"]()}
        </Button>
      </div>
    </div>
  );
}
