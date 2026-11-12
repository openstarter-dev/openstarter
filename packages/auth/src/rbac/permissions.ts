// packages/auth/src/rbac/permissions —— 平台角色与权限码的**代码内**唯一事实源。
//
// 背景（2026-11 迁移）：平台授权原先存放在 `role` / `permission` / `role_permission`
// / `user_role` 四张表里，支持动态建角色、多角色与角色到期。现改为与 better-auth
// `admin()` 插件同源：角色的唯一载体是 `user.role` 字段（支持逗号分隔多角色，与插件的
// `set-role` 语义一致），角色集合与权限码映射都在此文件内声明。
//
// 角色集合刻意与插件默认值（`admin` / `user`）保持一致：插件的 `set-role`、`adminRoles`
// 判定与这里共用同一批名字，避免出现「插件不认识的第三方角色」。需要新增角色时，
// 必须同时改这里与 `admin({ roles })`（插件侧用 better-auth 的 access control 定义）。
//
// 代价与收益：不再支持运行期增删角色、不再有角色到期；换来单一事实源、无需四张表、
// 后台授权与插件判定不会互相打架。

/** 平台内置角色（与 better-auth `admin()` 插件默认角色集对齐）。 */
export const PlatformRole = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

/**
 * 角色 → 权限码（`*` = 全部，`resource.*` = 该资源全部动作）。
 *
 * 权限码清单（与 `requirePermission(...)` 的调用点一一对应）：
 * `admin.*`、`analytics.read`、`post.{read,create,update,delete}`、
 * `taxonomy.{read,create,update,delete}`、`ticket.{read,reply,update}`。
 */
export const ROLE_PERMISSIONS: Record<PlatformRole, readonly string[]> = {
  [PlatformRole.ADMIN]: ["*"],
  [PlatformRole.USER]: [],
};

/** better-auth `admin()` 插件认可的管理员角色（`adminRoles`）。 */
export const ADMIN_ROLES: readonly PlatformRole[] = [PlatformRole.ADMIN];

/** 新用户默认角色，与 `admin({ defaultRole })` 保持一致。 */
export const DEFAULT_ROLE: PlatformRole = PlatformRole.USER;

/** 判定角色名是否在代码内定义（用于配置校验与种子脚本）。 */
export function isKnownRole(role: string): role is PlatformRole {
  return Object.hasOwn(ROLE_PERMISSIONS, role);
}

/**
 * 解析 `user.role` 字段：逗号分隔、去空白、去空项、去重。
 *
 * 与 better-auth `admin()` 对 `user.role` 的解析方式一致（`role.split(",")`），
 * 因此插件写入的多角色值在这里能被同一语义读出。
 */
export function parseRoles(role: string | null | undefined): string[] {
  if (!role) {
    return [];
  }
  const seen = new Set<string>();
  for (const item of role.split(",")) {
    const trimmed = item.trim();
    if (trimmed) {
      seen.add(trimmed);
    }
  }
  return [...seen];
}

/** 解析 `user.role` 得到去重后的权限码集合；未知角色名直接忽略。 */
export function resolvePermissions(role: string | null | undefined): string[] {
  const codes = new Set<string>();
  for (const name of parseRoles(role)) {
    if (!isKnownRole(name)) {
      continue;
    }
    for (const code of ROLE_PERMISSIONS[name]) {
      codes.add(code);
    }
  }
  return [...codes];
}

/** 判定 `user.role` 是否包含管理员角色（供 UI 与测试使用）。 */
export function hasAdminRole(role: string | null | undefined): boolean {
  const names = parseRoles(role);
  return ADMIN_ROLES.some((adminRole) => names.includes(adminRole));
}
