import { validateApiKey } from "@openstarter/auth/apikeys/service";
import { createAuth } from "@openstarter/auth/server";

import { type AuthDependencies, createAuthMiddlewares } from "./auth-core";

const authDependencies = {
  getSession: async (headers: Headers) =>
    await createAuth().api.getSession({ headers }),
  validateApiKey,
} satisfies AuthDependencies;

export const { apiKeyAuth, authMiddleware, requireAuth } =
  createAuthMiddlewares(authDependencies);
