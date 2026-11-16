import { toPermissionRequest } from "@openstarter/auth/rbac/access";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

export interface PermissionCheckInput {
  code: string;
  userId: string;
}

export type PermissionChecker = (input: PermissionCheckInput) => Promise<boolean>;

export const checkPlatformPermission: PermissionChecker = async ({ code, userId }) => {
  const { createAuth } = await import("../modules/auth/server");
  const permissions = toPermissionRequest(code);

  const { success } = await createAuth().api.userHasPermission({
    body: { permissions, userId },
  });
  return success;
};

export function createRequirePermission(
  code: string,
  check: PermissionChecker = checkPlatformPermission,
) {
  return createMiddleware<{ Variables: { userId: string } }>(async (context, next) => {
    const userId = context.get("userId");
    if (!userId) {
      return context.json(respErr("unauthorized"), 401);
    }

    const allowed = await check({ code, userId });
    if (!allowed) {
      return context.json(respErr("forbidden"), 403);
    }

    await next();
  });
}

export function requirePermission(code: string) {
  return createRequirePermission(code);
}
