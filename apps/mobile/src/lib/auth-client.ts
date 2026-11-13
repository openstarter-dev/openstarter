import {
  expoClient,
  setupExpoFocusManager,
  setupExpoOnlineManager,
} from "@better-auth/expo/client";
import { createAuthClient, emailOTPClient, magicLinkClient } from "@openstarter/auth/client/native";
import { getItem, getItemAsync, setItem, setItemAsync } from "expo-secure-store";

import { getEnv } from "./env";

const env = getEnv();

setupExpoFocusManager();
setupExpoOnlineManager();

export const authClient = createAuthClient({
  baseURL: env.ok ? env.apiUrl : "http://127.0.0.1",
  plugins: [
    emailOTPClient(),
    magicLinkClient(),
    expoClient({
      cookiePrefix: "openstarter",
      scheme: "openstarter",
      // better-auth 1.7 要求同时提供同步与异步读写（SecureStore 的异步 API 为其主路径）。
      storage: { getItem, getItemAsync, setItem, setItemAsync },
    }),
  ],
});

/**
 * 取出设备上存储的会话 cookie，供非 auth 的 API 请求携带。
 *
 * `getCookie()` 由 expoClient 提供，其官方注释即说明用途是"取出 cookie 并放进你自己的
 * fetch 请求头"。lib/api.ts 依此接线。
 */
export function getSessionCookie(): Promise<string> {
  // better-auth 1.7 起 expoClient.getCookie() 返回 Promise（内部改走 SecureStore 异步 API）。
  return authClient.getCookie();
}
