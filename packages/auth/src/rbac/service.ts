// packages/auth/src/rbac/service —— 平台级授权的数据访问（`user.role` 单字段）。
//
// 迁移说明（2026-11）：平台授权不再使用 `role`/`permission`/`role_permission`/
// `user_role` 四张表，角色的唯一载体是 better-auth `admin()` 插件写入的 `user.role`
// （可逗号分隔多角色）。角色到权限码的映射是代码常量，见 `./permissions`。
//
// 作用域边界：这里只回答「该用户有哪些权限码」，不涉及 organization 插件的团队
// 角色（`ac`/`roles`），二者互不覆盖。
//
// 依赖方向：auth 包内自带 `db()` 与 `user` 表定义，不反向依赖 @openstarter/api。

import { logger } from "@openstarter/shared/logger";
import { user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { eq } from "drizzle-orm";

import { matchAnyPermission, matchPermission } from "./matcher";
import { isKnownRole, resolvePermissions } from "./permissions";

/**
 * 取用户 `user.role` 解析出的权限码集合（去重）。未知角色名不贡献权限。
 *
 * 用户不存在时返回空数组（调用方按「无权限」处理，而不是抛错）。
 */
export async function getUserPermissionCodes(userId: string): Promise<string[]> {
  const [row] = await db()
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return resolvePermissions(row?.role);
}

/** 判定用户是否具备某权限码（含通配符）。 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const codes = await getUserPermissionCodes(userId);
  return matchPermission(permissionCode, codes);
}

/** 判定用户是否具备给定权限码中的任一项（含通配符）。 */
export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[],
): Promise<boolean> {
  const codes = await getUserPermissionCodes(userId);
  return matchAnyPermission(permissionCodes, codes);
}

/**
 * 为新用户授予配置指定的初始角色（受 Config 开关控制）。
 *
 * 仅在 `initial_role_enabled === "true"` 且 `initial_role_name` 是代码内已知角色时写入
 * `user.role`；否则保留插件写入的默认角色。写库失败只记日志、不抛出——此时用户已创建
 * 成功，初始化属副作用，不应中断注册主流程。
 */
export async function grantRoleForNewUser(params: {
  userId: string;
  configs: Record<string, string>;
}): Promise<void> {
  const { userId, configs } = params;

  if (configs.initial_role_enabled !== "true") {
    return;
  }

  const roleName = configs.initial_role_name?.trim();
  if (!roleName) {
    return;
  }

  if (!isKnownRole(roleName)) {
    logger.warn(`[auth] ignore unknown initial_role_name: ${roleName}`);
    return;
  }

  await db().update(user).set({ role: roleName }).where(eq(user.id, userId));
}
