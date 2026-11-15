export {
  adminClient,
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/react";

// Expo 平台的客户端插件（焦点/在线管理器 + expoClient）。
// 本子路径仅被 Expo 应用（apps/mobile）消费，不会进入其他端产物。
export {
  expoClient,
  setupExpoFocusManager,
  setupExpoOnlineManager,
} from "@better-auth/expo/client";
