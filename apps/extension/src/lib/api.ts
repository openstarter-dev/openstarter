import { hcWithType } from "@openstarter/api/client";

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
  return hcWithType(origin, {
    headers: () => buildAuthHeader(origin, cookieReader),
  });
}
