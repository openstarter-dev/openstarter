// apps/extension/src/lib/auth-client.ts —— 复用 @openstarter/auth/client/web 的插件集合，
// 叠加显式 baseURL（插件跨源，无法像 apps/web 一样靠相对路径）与 Bearer fetchOptions.auth
// （无法依赖同源 cookie，需要显式把 chrome.cookies 读到的会话值当 token 发出）。
// 不新增 packages/auth/src/client/extension.ts —— 差异只在"怎么拿 token"，属 chrome-only
// 代码，不应进入服务端也依赖的 packages/auth（见 spec §3.4）。
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

import type { CookieReader } from "./session";
import { readSessionToken } from "./session";

export function createExtensionAuthClient(
  origin: string,
  cookieReader: CookieReader
) {
  return createAuthClient({
    baseURL: origin,
    fetchOptions: {
      auth: {
        token: () =>
          readSessionToken(origin, cookieReader).then((t) => t ?? ""),
        type: "Bearer",
      },
    },
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
}
