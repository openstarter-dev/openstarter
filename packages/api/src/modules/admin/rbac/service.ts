// packages/api/src/modules/admin/rbac/service —— RBAC 管理操作的领域层。
//
// 角色/权限/用户-角色映射的底层持久化由 `@openstarter/auth` 提供；本服务在其上
// 承担两项职责，使路由层只剩「入参校验 + 状态码映射」：
//   1. 结果归一化：把「抛错 / 返回空」统一为可判别结果 {@link RbacResult}，
//      并区分「操作失败（400）」与「目标不存在（404）」。
//   2. 领域转换：角色过期时间由入参的 ISO 字符串转为 `Date` 后再落库。
//
// 路由层不再直接调用 auth 模块，也不再重复 try/catch 样板。

import {
  assignPermissionsToRole as assignPermissionsToRoleRecord,
  assignRoleToUser as assignRoleToUserRecord,
  createPermission as createPermissionRecord,
  createRole as createRoleRecord,
  deletePermission as deletePermissionRecord,
  deleteRole as deleteRoleRecord,
  getPermissions,
  getRolePermissions,
  getRoles,
  getUserRoles,
  removeRoleFromUser as removeRoleFromUserRecord,
  updatePermission as updatePermissionRecord,
  updateRole as updateRoleRecord,
} from "@openstarter/auth";

// ─── 结果类型（Result） ──────────────────────────────────────────────────────

/** 域操作结果：失败携带面向客户端的消息，`notFound` 时路由映射为 404。 */
export type RbacResult<T> =
  | { data: T; ok: true }
  | { message: string; notFound?: boolean; ok: false };

interface AttemptOptions {
  /** 抛出的错误没有 message 时的兜底文案。 */
  fallback: string;
  /** 返回 `null` / `undefined` 时的文案；缺省视为成功（用于无返回值的写操作）。 */
  nullMessage?: string;
  /** `null` / `undefined` 是否按「目标不存在」处理。 */
  notFound?: boolean;
}

async function attempt<T>(run: () => Promise<T>, options: AttemptOptions): Promise<RbacResult<T>> {
  try {
    const data = await run();
    if (options.nullMessage && (data === null || data === undefined)) {
      return { message: options.nullMessage, notFound: options.notFound, ok: false };
    }
    return { data, ok: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : options.fallback, ok: false };
  }
}

// ─── 角色（Role） ──────────────────────────────────────────────────────────────

export const listRoles = () => attempt(() => getRoles(), { fallback: "list roles failed" });

export interface CreateRoleInput {
  description?: string;
  name: string;
  title: string;
}

export const createRole = (input: CreateRoleInput) =>
  attempt(() => createRoleRecord(input), {
    fallback: "create role failed",
    nullMessage: "role not created",
  });

export interface UpdateRoleInput {
  description?: string;
  name?: string;
  title?: string;
}

export const updateRole = (id: string, input: UpdateRoleInput) =>
  attempt(() => updateRoleRecord(id, input), {
    fallback: "update role failed",
    notFound: true,
    nullMessage: "role not found",
  });

export const removeRole = (id: string) =>
  attempt(() => deleteRoleRecord(id), { fallback: "delete role failed" });

export const getPermissionsOfRole = (roleId: string) =>
  attempt(() => getRolePermissions(roleId), { fallback: "get role permissions failed" });

export const assignPermissionsToRole = (roleId: string, permissionIds: string[]) =>
  attempt(() => assignPermissionsToRoleRecord(roleId, permissionIds), {
    fallback: "assign permissions failed",
  });

// ─── 权限（Permission） ────────────────────────────────────────────────────────

export const listPermissions = () =>
  attempt(() => getPermissions(), { fallback: "list permissions failed" });

export interface CreatePermissionInput {
  action: string;
  code: string;
  resource: string;
  title: string;
}

export const createPermission = (input: CreatePermissionInput) =>
  attempt(() => createPermissionRecord(input), {
    fallback: "create permission failed",
    nullMessage: "permission not created",
  });

export interface UpdatePermissionInput {
  action?: string;
  code?: string;
  resource?: string;
  title?: string;
}

export const updatePermission = (id: string, input: UpdatePermissionInput) =>
  attempt(() => updatePermissionRecord(id, input), {
    fallback: "update permission failed",
    notFound: true,
    nullMessage: "permission not found",
  });

export const removePermission = (id: string) =>
  attempt(() => deletePermissionRecord(id), { fallback: "delete permission failed" });

// ─── 用户-角色映射（User ↔ Role） ─────────────────────────────────────────────

export const getRolesOfUser = (userId: string) =>
  attempt(() => getUserRoles(userId), { fallback: "get user roles failed" });

/** 授予角色；入参过期时间为 ISO 字符串，此处转换为 `Date`。 */
export const assignRoleToUser = (userId: string, roleId: string, expiresAt?: string) =>
  attempt(
    () => assignRoleToUserRecord(userId, roleId, expiresAt ? new Date(expiresAt) : undefined),
    { fallback: "assign role failed" },
  );

export const removeRoleFromUser = (userId: string, roleId: string) =>
  attempt(() => removeRoleFromUserRecord(userId, roleId), { fallback: "remove role failed" });
