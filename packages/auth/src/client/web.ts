export { apiKeyClient } from "@better-auth/api-key/client";
export { passkeyClient } from "@better-auth/passkey/client";
export {
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
  anonymousClient,
  adminClient,
  organizationClient,
  inferAdditionalFields,
  oneTapClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/react";
