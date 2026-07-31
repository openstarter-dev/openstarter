import type { PublicConfig } from "@/lib/use-public-config";

export const OAUTH_PROVIDERS = ["google", "github", "apple"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const CONFIG_KEYS: Record<OAuthProvider, string> = {
  apple: "apple_auth_enabled",
  github: "github_auth_enabled",
  google: "google_auth_enabled",
};

export const getEnabledOAuthProviders = (
  configs: PublicConfig
): OAuthProvider[] => {
  const enabledProviders: OAuthProvider[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    if (configs[CONFIG_KEYS[provider]] === "true") {
      enabledProviders.push(provider);
    }
  }
  return enabledProviders;
};
