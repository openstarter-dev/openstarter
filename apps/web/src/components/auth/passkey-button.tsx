import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export const isWebAuthnSupported = (): boolean =>
  typeof window !== "undefined" && Boolean(window.PublicKeyCredential);

interface PasskeyButtonProps {
  callbackURL?: string;
}

export function PasskeyButton(_props: PasskeyButtonProps) {
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
