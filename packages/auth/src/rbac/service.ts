// packages/auth/src/rbac/service —— 平台级 RBAC 的数据支撑（R7.1/R7.5/R7.6）。
//
// 角色 / 权限 / 角色-权限映射 / 用户-角色映射的 CRUD，以及基于通配符匹配器的权限判定。
// 权限码集合的获取严格排除**已过期**的 user_role（`expiresAt` 不为空且 <= now），
// 使过期角色不贡献任何权限（R7.5）。
//
// 作用域：平台级授权的唯一依据（Admin_Console 访问、API 端点授权、权限中间件），
// 与 better-auth `organization` 插件的 `ac`/`roles` 数据面独立、互不覆盖（R7.7/R7.8）。
//
// 数据访问：`@openstarter/db/server` 的 `db()` 单例访问器 + `@openstarter/db/schema` 表定义；
// drizzle 参数化查询（无字符串拼接）。

import { permission, role, rolePermission, userRole } from "@openstarter/db/schema";
import type { Permission, Role } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { matchAnyPermission, matchPermission } from "./matcher";

// ─── 角色 CRUD（Role）─────────────────────────────────────────────────────────

/** 列出全部启用中的角色（按创建时间倒序）。 */
export function getRoles(): Promise<Role[]> {
  return db()
    .select()
    .from(role)
    .where(eq(role.status, "active"))
    .orderBy(desc(role.createdAt));
}

/** 依名称查角色（不存在返回 undefined）。 */
export async function getRoleByName(name: string): Promise<Role | undefined> {
  const [result] = await db()
    .select()
    .from(role)
    .where(eq(role.name, name))
    .limit(1);
  return result;
}

/** 创建角色。 */
export async function createRole(data: {
  name: string;
  title: string;
  description?: string;
}): Promise<Role | undefined> {
  const [result] = await db()
    .insert(role)
    .values({ id: getUuid(), status: "active", ...data })
    .returning();
  return result;
}

/** 更新角色。 */
export async function updateRole(
  id: string,
  data: { name?: string; title?: string; description?: string }
): Promise<Role | undefined> {
  const [result] = await db()
    .update(role)
    .set(data)
    .where(eq(role.id, id))
    .returning();
  return result;
}

/** 软删除角色（置为非启用）。 */
export async function deleteRole(id: string): Promise<void> {
  await db().update(role).set({ status: "inactive" }).where(eq(role.id, id));
}

// ─── 权限 CRUD（Permission）───────────────────────────────────────────────────

/** 列出全部权限。 */
export function getPermissions(): Promise<Permission[]> {
  return db().select().from(permission);
}

/** 创建权限。 */
export async function createPermission(data: {
  code: string;
  resource: string;
  action: string;
  title: string;
  description?: string;
}): Promise<Permission | undefined> {
  const [result] = await db()
    .insert(permission)
    .values({ id: getUuid(), ...data })
    .returning();
  return result;
}

/** 更新权限。 */
export async function updatePermission(
  id: string,
  data: {
    code?: string;
    resource?: string;
    action?: string;
    title?: string;
    description?: string;
  }
): Promise<Permission | undefined> {
  const [result] = await db()
    .update(permission)
    .set(data)
    .where(eq(permission.id, id))
    .returning();
  return result;
}

/** 删除权限。 */
export async function deletePermission(id: string): Promise<void> {
  await db().delete(permission).where(eq(permission.id, id));
}

// ─── 角色-权限映射（Role ↔ Permission）─────────────────────────────────────────

/** 读取某角色的权限 id 列表。 */
export function getRolePermissions(
  roleId: string
): Promise<{ permissionId: string }[]> {
  return db()
    .select({ permissionId: rolePermission.permissionId })
    .from(rolePermission)
    .where(eq(rolePermission.roleId, roleId));
}

/** 覆盖式设置某角色的权限集合（先清空再写入）。 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  const database = db();
  await database.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
  if (permissionIds.length > 0) {
    await database.insert(rolePermission).values(
      permissionIds.map((permissionId) => ({
        id: getUuid(),
        roleId,
        permissionId,
      }))
    );
  }
}

// ─── 用户-角色映射（User ↔ Role）───────────────────────────────────────────────

/** 读取某用户的角色（含到期时间与角色元信息）。 */
export function getUserRoles(userId: string): Promise<
  {
    id: string;
    roleId: string;
    expiresAt: Date | null;
    roleName: string;
    roleTitle: string;
  }[]
> {
  return db()
    .select({
      id: userRole.id,
      roleId: userRole.roleId,
      expiresAt: userRole.expiresAt,
      roleName: role.name,
      roleTitle: role.title,
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .where(eq(userRole.userId, userId));
}

/** 为用户分配角色（可选到期时间）。 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  expiresAt?: Date
): Promise<void> {
  await db()
    .insert(userRole)
    .values({ id: getUuid(), userId, roleId, expiresAt: expiresAt ?? null });
}

/** 移除用户的某个角色。 */
export async function removeRoleFromUser(
  userId: string,
  roleId: string
): Promise<void> {
  await db()
    .delete(userRole)
    .where(and(eq(userRole.userId, userId), eq(userRole.roleId, roleId)));
}

// ─── 权限判定（Permission checks，R7.2–R7.5）───────────────────────────────────

/**
 * 取用户全部有效角色（排除已过期 user_role）经映射的权限码集合（去重）。R7.5
 */
export async function getUserPermissionCodes(userId: string): Promise<string[]> {
  const now = new Date();
  const database = db();

  // 有效角色：expiresAt 为空（永不过期）或 expiresAt > now。
  const activeRoles = await database
    .select({ roleId: userRole.roleId })
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, userId),
        or(isNull(userRole.expiresAt), gt(userRole.expiresAt, now))
      )
    );

  if (activeRoles.length === 0) {
    return [];
  }

  const roleIds = activeRoles.map((r) => r.roleId);
  const perms = await database
    .select({ code: permission.code })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(inArray(rolePermission.roleId, roleIds));

  return [...new Set(perms.map((p) => p.code))];
}

/** 判定用户是否具备某权限码（含通配符）。 */
export async function hasPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const codes = await getUserPermissionCodes(userId);
  return matchPermission(permissionCode, codes);
}

/** 判定用户是否具备给定权限码中的任一项（含通配符）。 */
export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  const codes = await getUserPermissionCodes(userId);
  return matchAnyPermission(permissionCodes, codes);
}

// ─── 新用户初始角色授予（R7.6）─────────────────────────────────────────────────

/**
 * 为新用户授予配置指定的初始角色（受 Config 开关控制）。
 *
 * 仅在 `initial_role_enabled === "true"` 且配置了有效角色名时授予。
 * **仅实现独立函数**：hook 装配（追加到 databaseHooks.user.create.after 且幂等）
 * 属阶段 2 任务 15，此处不装配，供其调用。
 */
export async function grantRoleForNewUser(params: {
  userId: string;
  configs: Record<string, string>;
}): Promise<void> {
  const { userId, configs } = params;

  if (configs.initial_role_enabled !== "true") {
    return;
  }

  const roleName = configs.initial_role_name;
  if (!roleName) {
    return;
  }

  const foundRole = await getRoleByName(roleName);
  if (!foundRole) {
    return;
  }

  await assignRoleToUser(userId, foundRole.id);
}
