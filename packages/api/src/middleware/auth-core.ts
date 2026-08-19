import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

const BEARER_PREFIX = "Bearer ";
const API_KEY_PREFIX = "sk_";

export interface Session {
  user: {
    email?: string;
    id: string;
  };
}

export interface AuthDependencies {
  getSession: (headers: Headers) => Promise<Session | null>;
  validateApiKey: (key: string) => Promise<string | null>;
}

export async function resolveApiKeyUserId(
  headers: Headers,
  validateKey: AuthDependencies["validateApiKey"],
): Promise<string | null> {
  const authorization = headers.get("authorization");
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  return await validateKey(token);
}

export function createRequireAuth(dependencies: AuthDependencies) {
  return createMiddleware<{
    Variables: { userId: string; session: Session | null };
  }>(async (c, next) => {
    const session = await dependencies.getSession(c.req.raw.headers);
    if (session?.user) {
      c.set("session", session);
      c.set("userId", session.user.id);
      await next();
      return;
    }

    const userId = await resolveApiKeyUserId(c.req.raw.headers, dependencies.validateApiKey);
    if (userId) {
      c.set("session", null);
      c.set("userId", userId);
      await next();
      return;
    }

    return c.json(respErr("unauthorized"), 401);
  });
}

export function createAuthMiddlewares(dependencies: AuthDependencies) {
  const authMiddleware = createMiddleware<{
    Variables: { session: Session | null };
  }>(async (c, next) => {
    const session = await dependencies.getSession(c.req.raw.headers);
    c.set("session", session);
    await next();
  });

  const apiKeyAuth = createMiddleware<{
    Variables: { userId: string };
  }>(async (c, next) => {
    const userId = await resolveApiKeyUserId(c.req.raw.headers, dependencies.validateApiKey);
    if (!userId) {
      return c.json(respErr("unauthorized"), 401);
    }

    c.set("userId", userId);
    await next();
  });

  return {
    apiKeyAuth,
    authMiddleware,
    requireAuth: createRequireAuth(dependencies),
  };
}
