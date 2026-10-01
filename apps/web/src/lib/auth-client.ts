// 前端 auth client：使用 @openstarter/auth/client/web 暴露的 better-auth 客户端插件集合，
// 与服务端 packages/auth 的插件装配保持一致（叠加而非裁剪）。
//
// oneTapClient：按运行时配置（google_one_tap_enabled + google_client_id）条件注册——
// 构造期需要 clientId，而公开配置是异步拉取的，故此客户端在配置就绪后惰性构建并缓存；
// 配置未开启或缺失 clientId 时 getOneTapAuthClient() 返回 null（不含 One Tap 动作）。

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
import type { PublicConfig } from "@/modules/public-config/lib/api";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    // 登录响应带 twoFactorRedirect 时跳转 2FA 验证页（better-auth fetch 插件回调）。
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/two-factor";
      },
    }),
    anonymousClient(),
    adminClient(),
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

/** 依据公开配置判定 One Tap 是否可用（开关开启且 clientId 非空）。 */
export const isOneTapEnabled = (configs: PublicConfig | undefined): boolean =>
  Boolean(configs?.google_one_tap_enabled === "true" && configs?.google_client_id);

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
      plugins: [
        passkeyClient(),
        magicLinkClient(),
        emailOTPClient(),
        twoFactorClient({
          onTwoFactorRedirect: () => {
            window.location.href = "/two-factor";
          },
        }),
        anonymousClient(),
        adminClient(),
        organizationClient(),
        lastLoginMethodClient(),
        oneTapClient({ clientId }),
      ],
    }) as unknown as AuthClientWithOneTap;
  }
  return oneTapClientInstance;
};

export { oneTapClient };
