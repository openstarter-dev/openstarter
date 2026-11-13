import { createAuth } from "@openstarter/auth/server";

import { type AuthDependencies, createAuthMiddlewares } from "./auth-core";

/** 校验 `sk_` 前缀的 API Key：交给官方插件（哈希比对、启用/过期/限流都在插件内）。 */
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
  validateApiKey,
} satisfies AuthDependencies;

export const { apiKeyAuth, authMiddleware, requireAuth } = createAuthMiddlewares(authDependencies);
