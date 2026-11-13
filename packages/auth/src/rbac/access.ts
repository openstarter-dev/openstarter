// packages/auth/src/rbac/access —— 平台授权定义的**唯一事实源**（better-auth access control）。
//
// 这里不再自己实现权限匹配：语句（resource → actions）与角色都用 better-auth 的
// `createAccessControl` 定义，判定交给它的 `role.authorize()` / 服务端
// `auth.api.userHasPermission` / 客户端 `authClient.admin.checkRolePermission`。
//
// 角色集合保持 `admin` / `user`（与 `admin()` 插件默认角色同名），避免出现插件不认识
// 的第三方角色；`user` / `session` 两类语句直接复用插件默认定义，因为插件自身的
// 管理端点（set-role / ban-user / impersonate-user …）就是用它们做校验的。
//
// 本文件必须保持**客户端可用**：不引用 db / server-only 模块，前端要为
// `adminClient({ ac, roles })` 传同一组定义，保证两侧判定一致。

import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as pluginAdminAc,
  defaultStatements as pluginDefaultStatements,
  userAc as pluginUserAc,
} from "better-auth/plugins/admin/access";

/**
 * 平台语句集 = admin 插件的默认语句（user / session）+ 业务资源。
 *
 * 业务动作名与历史权限码保持一致（`post.read` → `{ post: ["read"] }`），
 * 后台入口沿用 `admin.*`，其中 `*` 只是**动作名**，不参与任何通配计算。
 */
const PLATFORM_STATEMENTS = {
  ...pluginDefaultStatements,
  admin: ["*"],
  post: ["read", "create", "update", "delete"],
  taxonomy: ["read", "create", "update", "delete"],
  ticket: ["read", "reply", "update"],
  analytics: ["read"],
} as const;

export const platformAc = createAccessControl(PLATFORM_STATEMENTS);

/** 平台内置角色名（与 `admin()` 插件默认角色集对齐）。 */
export const PlatformRole = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

/** `admin()` 插件认可的管理员角色（`adminRoles`）。 */
export const ADMIN_ROLES: readonly PlatformRole[] = [PlatformRole.ADMIN];

/** 新用户默认角色，与 `admin({ defaultRole })` 保持一致。 */
export const DEFAULT_ROLE: PlatformRole = PlatformRole.USER;

/**
 * 平台角色 → 许可集合。
 *
 * `admin` 显式列出全部动作（better-auth 的 authorize 只做精确匹配，不支持 `*` 通配，
 * 所以这里把 `admin` 资源的动作名写成 `"*"`、其余资源逐个列举）。
 */
export const platformRoles = {
  admin: platformAc.newRole({
    ...pluginAdminAc.statements,
    admin: ["*"],
    post: ["read", "create", "update", "delete"],
    taxonomy: ["read", "create", "update", "delete"],
    ticket: ["read", "reply", "update"],
    analytics: ["read"],
  }),
  user: platformAc.newRole({
    ...pluginUserAc.statements,
  }),
};

/** 角色名是否在平台角色表中定义。 */
export function isKnownRole(role: string): role is PlatformRole {
  return Object.hasOwn(platformRoles, role);
}

/**
 * 把历史权限码（`resource.action`，如 `post.read` / `admin.*`）转成 access control
 * 的请求体，供 `userHasPermission` 与 `role.authorize()` 复用。
 *
 * 资源段不含点号，故按**第一个**点切分；动作段保留原样（`admin.*` 的动作就是 `"*"`）。
 */
export function toPermissionRequest(code: string): Record<string, string[]> {
  const separator = code.indexOf(".");
  if (separator <= 0 || separator === code.length - 1) {
    return { [code]: [] };
  }
  return { [code.slice(0, separator)]: [code.slice(separator + 1)] };
}
