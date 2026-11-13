// packages/auth/src/rbac/service —— 平台授权的服务端访问层（只负责“取角色 + 问 better-auth”）。
//
// 判定本身全部交给 better-auth：`platformRoles[role].authorize(request)`。
// 这里不实现任何通配符或前缀匹配逻辑，角色与语句的唯一来源是 `./access`。
//
// 为什么需要这一层：`auth.api.userHasPermission` 只能按**当前请求的会话**判定，
// 而 API Key 认证的调用方（`requireAuth` 支持 sk_ 前缀）没有会话。此时按 userId
// 读一次 `user.role` 再用同一组 `platformRoles` 判定，语义与插件端点一致。

import { user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { DEFAULT_ROLE, isKnownRole, platformRoles, toPermissionRequest } from "./access";

const UNKNOWN_ROLE = DEFAULT_ROLE;

/** 读取用户角色（`user.role`，可逗号分隔多角色）；用户不存在时回落到默认角色。 */
export async function getUserRole(userId: string): Promise<string> {
  const [row] = await db()
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row?.role?.trim() || UNKNOWN_ROLE;
}

/**
 * 判定用户是否具备某权限码（会话缺失时的兜底路径，例如 API Key 调用方）。
 *
 * 权限码形如 `resource.action`；多角色时任一角色通过即视为通过。
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const role = await getUserRole(userId);
  const request = toPermissionRequest(permissionCode);

  return role
    .split(",")
    .map((name) => name.trim())
    .some((name) => {
      if (!isKnownRole(name)) {
        return false;
      }
      return platformRoles[name].authorize(request).success;
    });
}

/**
 * 为新用户授予配置指定的初始角色（受 Config 开关控制）。
 *
 * 仅在 `initial_role_enabled === "true"` 且 `initial_role_name` 是已知角色时写入
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
