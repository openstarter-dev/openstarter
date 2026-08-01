// packages/auth/src/client/native.ts —— React Native 端可安全使用的 better-auth 客户端面。
// 与同目录 client/web.ts 并列：web.ts 面向浏览器，本文件面向 Expo / React Native。
//
// 与 web.ts 的差异只有"减去"两项，且都是平台原因而非取舍：
//   - passkeyClient：依赖浏览器 WebAuthn（navigator.credentials），RN 无此 API；
//   - oneTapClient：Google One Tap 是 Web 专属，且需构造期传入 clientId。
//
// 刻意不导出 expoClient：它的 peer 依赖（expo-constants / expo-linking /
// expo-network / expo-web-browser）属于移动应用，不应装进服务端也依赖的 packages/auth。
// 由 apps/mobile 自行从 @better-auth/expo/client 组合（见 spec §3.2）。
//
// 导出不等于启用：以下 plugin factory 是留给后续阶段的接线位，apps/mobile 首版只注册 expoClient。
// Spec: docs/superpowers/specs/2026-08-01-mobile-app-design.md §3.2 / §4。

export {
  adminClient,
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/react";
