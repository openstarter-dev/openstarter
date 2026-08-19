// apps/extension/src/lib/session.ts —— 从 web 端域下的 Better Auth 会话 cookie 中取出 token。
// 不缓存：每次调用都现读 cookie jar（见 spec §3.2 "不缓存 token"）。
// cookie 名解析顺序：先试 HTTPS 下的 __Secure- 前缀变体，再回退到无前缀名
// （advanced.cookiePrefix: "openstarter" → packages/auth/src/server.ts）。
// 注意 cookiePrefix 已从 turbostarter 改为 openstarter（commit 1308d88），因此 cookie 名
// 对应变更。见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §3.2。
import { browser } from "wxt/browser";

const COOKIE_NAME = "openstarter.session_token";
const SECURE_COOKIE_NAME = `__Secure-${COOKIE_NAME}`;

export type CookieReader = (origin: string, name: string) => Promise<{ value: string } | null>;

export async function readSessionToken(
  origin: string,
  cookieReader: CookieReader,
): Promise<string | null> {
  const secure = await cookieReader(origin, SECURE_COOKIE_NAME);
  if (secure) {
    return secure.value;
  }

  const plain = await cookieReader(origin, COOKIE_NAME);
  return plain ? plain.value : null;
}

export function chromeCookieReader(): CookieReader {
  return async (origin, name) => {
    const cookie = await browser.cookies.get({ name, url: origin });
    return cookie ? { value: cookie.value } : null;
  };
}
