import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { getOneTapAuthClient } from "@/lib/auth-client";
import { publicConfig } from "@/modules/public-config/lib/api";

interface OneTapPromptProps {
  /** One Tap 登录成功后的跳转地址（默认 /dashboard）。 */
  callbackURL?: string;
}

export function OneTapPrompt({ callbackURL = "/dashboard" }: OneTapPromptProps) {
  const configQuery = useQuery(publicConfig.queries.get());
  const configs = configQuery.data;

  useEffect(() => {
    const client = getOneTapAuthClient(configs);
    if (!client) {
      return;
    }
    void client.oneTap({ callbackURL }).catch((error: unknown) => {
      console.warn("Google One Tap prompt failed:", error);
    });
  }, [callbackURL, configs]);

  return null;
}
