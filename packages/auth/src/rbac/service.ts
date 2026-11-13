// packages/auth/src/rbac/service —— 平台角色的**写入**侧（新用户初始角色）。
//
// 权限判定已全部交给 better-auth：调用方直接使用
// `auth.api.userHasPermission`（服务端）或 `authClient.admin.checkRolePermission`（浏览器），
// 本模块不再自行读取角色做判定。
//
// 角色定义（语句与角色）见 `./access`；这里只负责把配置里的初始角色写进 `user.role`。

import { user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { isKnownRole } from "./access";

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
