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
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import type { PublicConfig } from "@/modules/public-config/lib/api";

// better-auth 客户端在浏览器里默认同源（baseURL = 当前 origin），无需配置；
// 只有 SSR 会因相对 URL 无法解析（"Failed to parse URL"）而整页 500，故仅在服务端显式给出地址：
//  - 读 process.env.VITE_APP_URL（唯一事实源 apps/web/.env）。不能换成 import.meta.env：
//    那是构建期静态内联，Cloudflare Workers 的 wrangler vars 在运行时才注入，两者会漂移；
//  - 浏览器端不读该变量：配置值在局域网 IP / 预览域名访问时会指向别的域名（跨域失败），
//    同源 origin 天然正确。
// 注：受保护路由的 SSR 会话已改走 functions/session.ts（转发 Cookie 直连 better-auth），
// 这里的 baseURL 只是防止服务端误用本客户端时的兜底——SSR 下 getSession() 仍拿不到 cookie。
const serverBaseURL =
  typeof window === "undefined"
    ? (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "")
    : undefined;

export const authClient = createAuthClient({
  ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
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
      ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
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
