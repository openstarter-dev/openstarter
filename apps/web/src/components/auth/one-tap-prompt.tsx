import { useEffect } from "react";

import { getOneTapAuthClient } from "@/lib/auth-client";

interface OneTapPromptProps {
  callbackURL?: string;
}

export function OneTapPrompt({ callbackURL = "/dashboard" }: OneTapPromptProps) {
  useEffect(() => {
    const client = getOneTapAuthClient();
    if (!client) {
      return;
    }
    void client.oneTap({ callbackURL }).catch((error: unknown) => {
      console.warn("Google One Tap prompt failed:", error);
    });
  }, [callbackURL]);

  return null;
}
