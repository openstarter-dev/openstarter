// 前端 auth client：使用 @openstarter/auth/client/web 暴露的 better-auth 客户端插件集合，
// 与服务端 packages/auth 的插件装配保持一致（叠加而非裁剪）。
//
// 说明：oneTap 需在构造时提供 clientId（依 Config 动态启用），故不并入此默认客户端；
// 需要 Google One Tap 的场景应按运行时配置单独构造带 oneTapClient 的客户端。

import {
  adminClient,
  anonymousClient,
  createAuthClient,
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  passkeyClient,
  twoFactorClient,
} from "@openstarter/auth/client/web";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient(),
    anonymousClient(),
    adminClient(),
    organizationClient(),
    lastLoginMethodClient(),
  ],
});
