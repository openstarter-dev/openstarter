// packages/api/src/middleware/rbac —— 平台级权限中间件。
//
// 判定完全交给 better-auth：权限码（`resource.action`）转成 access control 请求体后，
// 调用 `auth.api.userHasPermission`；角色与语句定义在 packages/auth/src/rbac/access.ts，
// 与 admin 插件、浏览器端 `checkRolePermission` 共用同一组对象。
//
// 两条调用路径：
//   - 有会话（浏览器）：带上请求头，以会话用户为准；
//   - 无会话（API Key 认证，`requireAuth` 允许 `sk_` 前缀）：传 `userId`，由插件查用户后判定。
//
// 边界：与 organization 插件的团队角色完全解耦，不读取任何组织成员关系。
// 须在 `requireAuth` 之后使用（读取 `c.var.userId`）。

import { toPermissionRequest } from "@openstarter/auth/rbac/access";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

export interface PermissionCheckInput {
  code: string;
  headers: Headers;
  userId: string;
}

/** 权限判定函数（可注入，便于测试拒绝语义而不依赖数据库或会话）。 */
export type PermissionChecker = (input: PermissionCheckInput) => Promise<boolean>;

/**
 * 生产判定：优先按会话问 better-auth；没有会话（API Key）时改传 `userId`
 * （插件内部会带 userId 查用户，仍走同一套 ac/roles）。
 *
 * 注意不能同时传 headers 与 userId：插件在「无会话但带 headers」时直接 401，
 * 因此两条路径必须分开调用。
 */
export const checkPlatformPermission: PermissionChecker = async ({ code, headers, userId }) => {
  // 动态引入：auth 实例在模块求值时会校验 env，按需加载可避免仅为注册中间件
  // 就拉整条 auth 初始化链（也让纯单元测试无需准备 env）。
  const { createAuth } = await import("@openstarter/auth/server");
  const permissions = toPermissionRequest(code);

  try {
    const { success } = await createAuth().api.userHasPermission({
      body: { permissions },
      headers,
    });
    return success;
  } catch {
    const { success } = await createAuth().api.userHasPermission({
      body: { permissions, userId },
    });
    return success;
  }
};

/** 生成可注入判定函数的守卫；缺少 userId 返回 401，权限不足返回 403。 */
export function createRequirePermission(
  code: string,
  check: PermissionChecker = checkPlatformPermission,
) {
  return createMiddleware<{ Variables: { userId: string } }>(async (context, next) => {
    const userId = context.get("userId");
    if (!userId) {
      return context.json(respErr("unauthorized"), 401);
    }

    const allowed = await check({ code, headers: context.req.raw.headers, userId });
    if (!allowed) {
      return context.json(respErr("forbidden"), 403);
    }

    await next();
  });
}

/** 生产平台权限守卫。 */
export function requirePermission(code: string) {
  return createRequirePermission(code);
}
