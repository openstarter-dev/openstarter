import { m } from "@openstarter/i18n-web/messages";
import { Button } from "@openstarter/ui-web/components/button";
import { useNavigate } from "@tanstack/react-router";
import { Ghost } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

interface AnonymousButtonProps {
  callbackURL?: string;
}

export function AnonymousButton({ callbackURL = "/dashboard" }: AnonymousButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result?.error) {
        toast.error(result.error.message ?? m["common.sign.guest_failed"]());
        return;
      }
      toast.success(m["common.sign.guest_success"]());
      await navigate({ to: callbackURL });
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
      <Ghost aria-hidden="true" className="size-4" />
      {submitting ? m["common.sign.guest_creating"]() : m["common.sign.guest_title"]()}
    </Button>
  );
}
