import {
  adminClient,
  anonymousClient,
  createAuthClient,
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  oneTapClient,
  organizationClient,
  passkeyClient,
  twoFactorClient,
} from "@openstarter/auth/client/web";
import { platformAc, platformRoles } from "@openstarter/auth/rbac/access";
import { localizeUrl } from "@openstarter/i18n-web/runtime";
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import type { PublicConfig } from "@/modules/public-config/lib/api";

const serverBaseURL =
  typeof window === "undefined"
    ? (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "")
    : undefined;

/**
 * 二步验证页跳转。必须走 i18n 的 URL 策略：硬编码 `/two-factor` 会让以
 * `/zh` 开头的用户落到无前缀 URL，locale 回退到 baseLocale（en）。
 */
function goToTwoFactor() {
  window.location.href = localizeUrl(`${window.location.origin}/two-factor`).href;
}

export const authClient = createAuthClient({
  ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({ onTwoFactorRedirect: goToTwoFactor }),
    anonymousClient(),
    adminClient({ ac: platformAc, roles: platformRoles }),
    organizationClient(),
    lastLoginMethodClient(),
  ],
});

type AuthClient = typeof authClient;
/** better-auth oneTapClient 暴露的动作签名（oneTap(opts?, fetchOptions?)）。 */
export type OneTapAction = ReturnType<ReturnType<typeof oneTapClient>["getActions"]>["oneTap"];
/** 实际的 oneTapClient 动作挂载形状：`authClient.oneTap(...)`。 */
type AuthClientWithOneTap = AuthClient & { oneTap: OneTapAction };

let oneTapClientInstance: AuthClientWithOneTap | null = null;

/**
 * 依据公开配置判定 One Tap 是否可用。
 *
 * 服务端只有在「Google provider 已注册 + One Tap 开关开启 + 有 clientId」三者同时满足时
 * 才挂载 oneTap 插件，故这里必须同样要求 `google_auth_enabled`，否则会弹出提示却回调 404。
 */
export const isOneTapEnabled = (configs: PublicConfig | undefined): boolean =>
  Boolean(
    configs?.google_auth_enabled === "true" &&
    configs?.google_one_tap_enabled === "true" &&
    configs?.google_client_id,
  );

/**
 * 返回带 One Tap 动作的 auth client（模块级单例缓存）。
 * One Tap 未启用时返回 null——调用方据此决定是否触发 One Tap 弹窗。
 */
export const getOneTapAuthClient = (
  configs: PublicConfig | undefined,
): AuthClientWithOneTap | null => {
  if (!isOneTapEnabled(configs) || !configs) {
    return null;
  }
  const clientId: string = configs.google_client_id;
  if (!oneTapClientInstance) {
    oneTapClientInstance = createAuthClient({
      ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
      plugins: [
        passkeyClient(),
        magicLinkClient(),
        emailOTPClient(),
        twoFactorClient({ onTwoFactorRedirect: goToTwoFactor }),
        anonymousClient(),
        adminClient({ ac: platformAc, roles: platformRoles }),
        organizationClient(),
        lastLoginMethodClient(),
        oneTapClient({ clientId }),
      ],
    }) as unknown as AuthClientWithOneTap;
  }
  return oneTapClientInstance;
};

export { oneTapClient };
