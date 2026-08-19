// apps/extension/src/lib/api.ts —— 类型化 Hono RPC 客户端，携带 Bearer 会话头。
// 与 apps/web/src/lib/api.ts 的差异只有两点：绝对 base URL（插件跑在
// chrome-extension:// 源，不能靠相对路径）+ 显式 Authorization 头（无法依赖同源 cookie）。
// 见 spec §3.2/§6。
import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

import type { CookieReader } from "./session";
import { readSessionToken } from "./session";

export async function buildAuthHeader(
  origin: string,
  cookieReader: CookieReader,
): Promise<Record<string, string>> {
  const token = await readSessionToken(origin, cookieReader);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function createExtensionApiClient(origin: string, cookieReader: CookieReader) {
  return hc<AppType>(origin, {
    headers: () => buildAuthHeader(origin, cookieReader),
  });
}
