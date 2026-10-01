// Passkey 登录入口：浏览器 WebAuthn 流程（better-auth passkeyClient）。
// 由 passkey 插件注册即可用（服务端 passkey() 无条件挂载，无 admin 开关）；
// 仅在浏览器支持 WebAuthn（window.PublicKeyCredential）时渲染按钮。

import { Button } from "@openstarter/ui-web/components/button";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

export const isWebAuthnSupported = (): boolean =>
  typeof window !== "undefined" && Boolean(window.PublicKeyCredential);

interface PasskeyButtonProps {
  /** 保留以与其它登录按钮签名对齐（passkey 登录后跳转由 WebAuthn 流程决定）。 */
  callbackURL?: string;
}

export function PasskeyButton(_props: PasskeyButtonProps) {
  // 认证页路由为 ssr:false，此处可直接在首渲时同步探测 WebAuthn 能力。
  const [supported] = useState(isWebAuthnSupported);
  const [submitting, setSubmitting] = useState(false);

  if (!supported) {
    return null;
  }

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        toast.error(result.error.message ?? m["common.sign.passkey_failed"]());
        return;
      }
      toast.success(m["common.sign.two_factor_success"]());
    } catch (error) {
      // 用户取消 WebAuthn 弹窗等浏览器侧异常：静默即可，无需报错打断。
      if (error instanceof Error && error.name === "NotAllowedError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : m["common.sign.passkey_failed"]());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      className="w-full"
      disabled={submitting}
      onClick={handleSignIn}
      type="button"
      variant="outline"
    >
      <Fingerprint aria-hidden="true" className="size-4" />
      {submitting ? m["common.sign.passkey_waiting"]() : m["common.sign.passkey_title"]()}
    </Button>
  );
}
