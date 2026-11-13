import { anonymousAuthEnabled, createAuth } from "@openstarter/auth/server";

import { type AuthDependencies, createAuthMiddlewares } from "./auth-core";

const validateApiKey = async (key: string): Promise<string | null> => {
  try {
    const { valid, key: record } = await createAuth().api.verifyApiKey({ body: { key } });
    return valid ? (record?.referenceId ?? null) : null;
  } catch {
    return null;
  }
};

const authDependencies = {
  getSession: async (headers: Headers) => await createAuth().api.getSession({ headers }),
  isAnonymousAllowed: () => anonymousAuthEnabled,
  validateApiKey,
} satisfies AuthDependencies;

export const { apiKeyAuth, authMiddleware, requireAuth } = createAuthMiddlewares(authDependencies);
