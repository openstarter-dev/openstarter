import { toPermissionRequest } from "@openstarter/auth/rbac/access";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

export interface PermissionCheckInput {
  code: string;
  userId: string;
}

export type PermissionChecker = (input: PermissionCheckInput) => Promise<boolean>;

// Resolve via userId (already set by requireAuth from the session or API key) — one
// better-auth call, no session re-resolution.
// 直接用 userId（requireAuth 已从 session 或 API key 解析）判定 —— 单次 better-auth 调用。
export const checkPlatformPermission: PermissionChecker = async ({ code, userId }) => {
  const { createAuth } = await import("@openstarter/auth/server");
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
