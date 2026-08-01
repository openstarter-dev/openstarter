// apps/mobile/src/lib/auth-client.ts —— Better Auth 原生客户端。
//
// 三处必须对齐、错一个就静默失效：
//   1. scheme "openstarter" —— 与 app.config.ts 的 scheme、服务端 trustedOrigins
//      的 "openstarter://" 同名，OAuth 深链才能回跳到应用；
//   2. cookiePrefix "openstarter" —— 与服务端 advanced.cookiePrefix 同值。Expo 插件
//      默认按 "better-auth" 前缀识别 cookie，不对齐会表现为反复重拉会话或登录后立刻掉线；
//   3. storage 用 expo-secure-store —— 其 getItem/setItem 是同步 API 且 getItem 返回
//      string | null，正好满足 ExpoClientOptions.storage 的契约，会话因此落在
//      iOS 钥匙串 / Android KeyStore，而不是普通存储。
//
// plugins 首版只注册 expoClient：邮箱密码与 OAuth 属 better-auth 核心能力，不需要插件。
// 其余插件位在 @openstarter/auth/client/native 已导出，后续启用只需往数组里加一项。
// Spec §4。
import {
  expoClient,
  setupExpoFocusManager,
  setupExpoOnlineManager,
} from "@better-auth/expo/client";
import { createAuthClient } from "@openstarter/auth/client/native";
import { getItem, setItem } from "expo-secure-store";

import { getEnv } from "./env";

const env = getEnv();

// 会话保鲜（spec §4）：这两个函数不是 createAuthClient 的选项，而是把 Expo 的
// AppState / 网络状态适配器装到全局管理器的副作用调用。better-auth 的会话刷新据此
// 在应用回到前台或网络恢复时重新校验会话。必须在 createAuthClient 之前调用。
// 两者都是幂等的（内部先判全局管理器是否已存在）。
setupExpoFocusManager();
setupExpoOnlineManager();

export const authClient = createAuthClient({
  // 配置非法时给一个占位 base URL：此时界面会停在配置错误屏（见 (auth)/(tabs) 门禁），
  // 不会真的发出请求，但 createAuthClient 需要一个可解析的字符串。
  baseURL: env.ok ? env.apiUrl : "http://127.0.0.1",
  plugins: [
    expoClient({
      cookiePrefix: "openstarter",
      scheme: "openstarter",
      // 同步 API（getItem 返回 string | null），正好满足 ExpoClientOptions.storage。
      storage: { getItem, setItem },
    }),
  ],
});

/**
 * 取出设备上存储的会话 cookie，供非 auth 的 API 请求携带。
 *
 * `getCookie()` 由 expoClient 提供，其官方注释即说明用途是"取出 cookie 并放进你自己的
 * fetch 请求头"。lib/api.ts 依此接线。
 */
export function getSessionCookie() {
  return authClient.getCookie();
}
