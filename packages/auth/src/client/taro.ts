// packages/auth/src/client/taro.ts
// Taro 端 better-auth 客户端（bearer token 模式）。
// 使用非 React 的 fetch client，不依赖 @tarojs/taro。
// 由 apps/mini-app 自行传入 Taro.request 适配的 fetch 实现。

export {
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
  anonymousClient,
  adminClient,
  organizationClient,
  inferAdditionalFields,
  lastLoginMethodClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/client";