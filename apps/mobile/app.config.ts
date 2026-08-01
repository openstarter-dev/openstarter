import type { ExpoConfig } from "expo/config";

// scheme 必须与 packages/auth/src/server.ts 的 trustedOrigins("openstarter://")
// 以及 expoClient({ scheme }) 三处同名，否则 OAuth 深链回跳不会落回应用。
// bundleIdentifier / package 两端取同一值，避免深链与 OAuth 回调配置分叉；
// 该值还必须与服务端 APPLE_APP_BUNDLE_IDENTIFIER 环境变量一致，否则 Apple 登录不通。
const BUNDLE_IDENTIFIER = "dev.openstarter.app";

const config: ExpoConfig = {
  android: {
    package: BUNDLE_IDENTIFIER,
  },
  ios: {
    bundleIdentifier: BUNDLE_IDENTIFIER,
    supportsTablet: true,
  },
  name: "OpenStarter",
  orientation: "portrait",
  // expo-secure-store 的 config plugin 是 requireAuthentication 等原生能力的前提；
  // expo-router 插件启用文件式路由。
  plugins: ["expo-router", "expo-secure-store"],
  scheme: "openstarter",
  slug: "openstarter",
  userInterfaceStyle: "automatic",
  version: "0.1.0",
};

export default config;
