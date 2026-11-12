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
