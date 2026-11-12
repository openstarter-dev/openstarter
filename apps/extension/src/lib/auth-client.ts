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

export function createExtensionAuthClient(origin: string, cookieReader: CookieReader) {
  return createAuthClient({
    baseURL: origin,
    fetchOptions: {
      auth: {
        token: () => readSessionToken(origin, cookieReader).then((t) => t ?? ""),
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
