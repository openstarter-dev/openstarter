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
    // Apple 登录（servicesIdentityKey 由 expo-apple-authentication 运行时处理）：
    // Sign in with Apple entitlement 是 App Store 审核的硬性要求 —— 只要应用
    // 提供任何第三方登录（Google），就必须同时提供 Apple 登录（指南 4.8）。
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
    },
  },
  name: "OpenStarter",
  orientation: "portrait",
  // expo-updates 已安装时必须声明 runtimeVersion，否则 dev client 启动会报
  // "Invalid updates configuration ... must include a valid runtime version"。
  // 本地开发用 appVersion 策略即可；正式 OTA 时再切 fingerprint 策略。
  runtimeVersion: {
    policy: "appVersion",
  },
  // expo-secure-store 的 config plugin 是 requireAuthentication 等原生能力的前提；
  // expo-router 插件启用文件式路由。
  // RevenueCat（react-native-purchases）无需 config plugin，仅要求 dev client/prebuild
  // （StoreKit / In-App Purchase 能力在 Xcode 侧启用）。
  // with-firebase-config 已暂时停用（react-native-firebase 依赖已移除，原生
  // autolinking 不再包含 RNFB，故不再需要 SPM/static 兼容补丁）。
  // 恢复 Firebase 时：加回 @react-native-firebase/app/analytics 依赖，
  // 并在此注册 "./plugins/with-firebase-config"（两个配置文件都缺失时 no-op）。
  // expo-image 的 plugin 由 expo install 提示补入（Android 端图片能力接线）。
  // expo-haptics 自动注入 Android VIBRATE 权限，无需 plugin。
  // expo-video / expo-sharing 的 plugin 同样由 expo install 提示补入。
  // expo-web-browser / expo-screen-orientation 无 config plugin；expo-auth-session
  // 使用时须与 expo-crypto 同装（PKCE），项目已在 auth 链路引入。
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image",
    "expo-video",
    "expo-sharing",
    // Firebase 已暂时停用：@react-native-firebase/* 依赖已移除，不注册
    // ./plugins/with-firebase-config（恢复时加回；它负责注入
    // $RNFirebaseDisableSPM / $RNFirebaseAsStaticFramework 以兼容静态链接）。
  ],
  scheme: "openstarter",
  slug: "openstarter",
  userInterfaceStyle: "automatic",
  version: "0.1.0",
  // EAS 项目 ID：`eas init` 后由用户回填（eas init 只会补丁 app.json，不会改本文件）。
  // 缺失时 eas build/submit 会报 "project not linked"，属预期占位而非配置错误。
  extra: {
    // eas: {
    //   projectId: "00000000-0000-0000-0000-000000000000",
    // },
  },
};

export default config;
