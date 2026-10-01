// Google One Tap 提示：依公开配置（google_one_tap_enabled + google_client_id）惰性构建
// 带 oneTapClient 的 auth client 并触发 One Tap 弹窗。配置未开启时不渲染任何内容。
//
// 注意：oneTapClient 需在 createAuthClient 构造期提供 clientId，故此处不走默认
// authClient，而是经 getOneTapAuthClient(configs) 获取（内部缓存同一实例）。

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
      // One Tap 提示被浏览器拦截/用户已持久拒绝时静默；不打断正常登录流程。
      console.warn("Google One Tap prompt failed:", error);
    });
  }, [callbackURL, configs]);

  return null;
}
