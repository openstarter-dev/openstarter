import { getWebConfig, type WebAuthConfig } from "@/config";

export const OAUTH_PROVIDERS = ["google", "github", "apple"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const AUTH_FLAG_KEYS: Record<OAuthProvider, keyof OAuthSwitchConfig> = {
  apple: "appleEnabled",
  github: "githubEnabled",
  google: "googleEnabled",
};

type OAuthSwitchConfig = Pick<WebAuthConfig, "appleEnabled" | "githubEnabled" | "googleEnabled">;

export const getEnabledOAuthProviders = (
  auth: OAuthSwitchConfig = getWebConfig().auth,
): OAuthProvider[] => OAUTH_PROVIDERS.filter((provider) => auth[AUTH_FLAG_KEYS[provider]]);
