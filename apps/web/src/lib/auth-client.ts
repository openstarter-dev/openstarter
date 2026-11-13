import {
  adminClient,
  apiKeyClient,
  anonymousClient,
  createAuthClient,
  emailOTPClient,
  magicLinkClient,
  oneTapClient,
  organizationClient,
  passkeyClient,
  twoFactorClient,
} from "@openstarter/auth/client/web";
import { platformAc, platformRoles } from "@openstarter/auth/rbac/access";
import { localizeUrl } from "@openstarter/i18n-web/runtime";
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import type { PublicConfig } from "@/modules/public-config/lib/api";

const serverBaseURL =
  typeof window === "undefined"
    ? (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "")
    : undefined;

function goToTwoFactor() {
  window.location.href = localizeUrl(`${window.location.origin}/two-factor`).href;
}

export const authClient = createAuthClient({
  ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({ onTwoFactorRedirect: goToTwoFactor }),
    anonymousClient(),
    adminClient({ ac: platformAc, roles: platformRoles }),
    apiKeyClient(),
    organizationClient(),
  ],
});

type AuthClient = typeof authClient;
export type OneTapAction = ReturnType<ReturnType<typeof oneTapClient>["getActions"]>["oneTap"];
type AuthClientWithOneTap = AuthClient & { oneTap: OneTapAction };

let oneTapClientInstance: AuthClientWithOneTap | null = null;

export const isOneTapEnabled = (configs: PublicConfig | undefined): boolean =>
  Boolean(
    configs?.google_auth_enabled === "true" &&
    configs?.google_one_tap_enabled === "true" &&
    configs?.google_client_id,
  );

export const getOneTapAuthClient = (
  configs: PublicConfig | undefined,
): AuthClientWithOneTap | null => {
  if (!isOneTapEnabled(configs) || !configs) {
    return null;
  }
  const clientId: string = configs.google_client_id;
  if (!oneTapClientInstance) {
    oneTapClientInstance = createAuthClient({
      ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
      plugins: [
        passkeyClient(),
        magicLinkClient(),
        emailOTPClient(),
        twoFactorClient({ onTwoFactorRedirect: goToTwoFactor }),
        anonymousClient(),
        adminClient({ ac: platformAc, roles: platformRoles }),
        apiKeyClient(),
        organizationClient(),
        oneTapClient({ clientId }),
      ],
    }) as unknown as AuthClientWithOneTap;
  }
  return oneTapClientInstance;
};

export { oneTapClient };
