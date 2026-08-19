// packages/api/src/middleware/rbac —— 平台级 RBAC 权限中间件（R4.3/R7.7/R7.8）。
//
// `requirePermission(code)` 解析当前主体（会话用户或 API Key 所属用户）的权限码集合后，
// **仅**以通配符匹配器 `matchPermission` 判定，缺失权限返回 403。
//
// 明确边界：平台级授权唯一依据通配符 RBAC，与 better-auth `organization` 插件的 `ac`/`roles`
// 完全解耦——不读取任何组织成员关系或团队角色。须在 `requireAuth` 之后使用（读取 `c.var.userId`）。

import { matchPermission } from "@openstarter/auth/rbac/matcher";
import { getUserPermissionCodes } from "@openstarter/auth/rbac/service";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

export type PermissionCodeResolver = (userId: string) => Promise<string[]>;

/**
 * 生成可注入权限解析器的校验中间件。该 seam 让拒绝语义无需数据库或外部服务即可验证，
 * 且依赖面只包含平台权限码，不接受 organization 授权数据。
 */
export function createRequirePermission(
  code: string,
  resolvePermissionCodes: PermissionCodeResolver,
) {
  return createMiddleware<{ Variables: { userId: string } }>(async (context, next) => {
    const userId = context.get("userId");
    if (!userId) {
      return context.json(respErr("unauthorized"), 401);
    }

    const codes = await resolvePermissionCodes(userId);
    if (!matchPermission(code, codes)) {
      return context.json(respErr("forbidden"), 403);
    }

    await next();
  });
}

/**
 * 生产平台权限守卫。缺少该权限（通配符匹配后仍不命中）返回 403；
 * 未解析到主体（未先经 requireAuth）返回 401。
 */
export function requirePermission(code: string) {
  return createRequirePermission(code, getUserPermissionCodes);
}
