// packages/api/src/middleware/rbac —— 平台级权限中间件。
//
// 判定不再自建：权限码（`resource.action`）转成 access control 请求体后，交给
// better-auth 的 `auth.api.userHasPermission`（服务端，使用 admin 插件的 ac/roles）。
// 无会话的调用方（API Key 认证）走 `hasPermission(userId, code)` 兜底，
// 它用的是同一组 `platformRoles`，语义与插件端点一致。
//
// 边界：与 organization 插件的团队角色完全解耦，不读取任何组织成员关系。
// 须在 `requireAuth` 之后使用（读取 `c.var.userId`）。

import { toPermissionRequest } from "@openstarter/auth/rbac/access";
import { hasPermission } from "@openstarter/auth/rbac/service";
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
 * 生产判定：优先按会话问 better-auth（`userHasPermission` 直接复用插件里配置的
 * ac/roles）；没有会话（API Key）时退回按 userId 读 `user.role` 的同一套角色判定。
 */
export const checkPlatformPermission: PermissionChecker = async ({ code, headers, userId }) => {
  try {
    // 动态引入：auth 实例在模块求值时会校验 env，按需加载可避免仅为注册中间件
    // 就拉整条 auth 初始化链（也让纯单元测试无需准备 env）。
    const { createAuth } = await import("@openstarter/auth/server");
    const { success } = await createAuth().api.userHasPermission({
      body: { permissions: toPermissionRequest(code) },
      headers,
    });
    return success;
  } catch {
    return hasPermission(userId, code);
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
