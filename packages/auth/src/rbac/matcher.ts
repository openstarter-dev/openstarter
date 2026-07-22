// packages/auth/src/rbac/matcher —— 平台级通配符权限匹配（纯函数，可单测/属性测试）。
//
// 平台授权的唯一判定依据（R7.2/R7.3/R7.4，见 design.md「RBAC 通配符权限匹配」）。
// 与 better-auth `organization` 插件的 `ac`/`roles`（团队作用域）完全解耦：这里只处理
// ShipAny 风格的字符串权限码与通配符，不读取任何组织成员关系。
//
// 匹配顺序：精确命中 → 自最长前缀向短逐级尝试 `resource.*` 通配 → 全局 `*`。
// 例如判定 `a.b.c` 时依次检查 `a.b.c`、`a.b.*`、`a.*`、`*`。

/**
 * 平台内置角色名（对齐 ShipAny `core/auth/rbac` 的 `ROLES`）。
 *
 * 作为平台作用域角色的稳定标识，供初始角色授予、种子数据与后台展示复用；
 * 不同于 better-auth organization 插件的团队角色（owner/admin/member）。
 */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * 判定 `code` 是否被 `granted` 权限码集合授予（含通配符）。
 *
 * @param code 待判定的具体权限码，如 `post.update`。
 * @param granted 主体已被授予的权限码集合（可含 `resource.*` 或 `*`）。
 */
export function matchPermission(code: string, granted: string[]): boolean {
  // 1. 精确命中。
  if (granted.includes(code)) {
    return true;
  }

  // 2. 逐级前缀通配：`a.b.c` → `a.b.*` → `a.*`。
  const parts = code.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = `${parts.slice(0, i).join(".")}.*`;
    if (granted.includes(wildcard)) {
      return true;
    }
  }

  // 3. 全局通配。
  return granted.includes("*");
}

/**
 * 判定 `codes` 中是否存在**任一**权限码被 `granted` 授予（含通配符）。
 */
export function matchAnyPermission(codes: string[], granted: string[]): boolean {
  return codes.some((code) => matchPermission(code, granted));
}

/**
 * 判定 `codes` 中是否**全部**权限码都被 `granted` 授予（含通配符）。
 */
export function matchAllPermissions(codes: string[], granted: string[]): boolean {
  return codes.every((code) => matchPermission(code, granted));
}
