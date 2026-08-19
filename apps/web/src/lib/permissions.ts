// apps/web/src/lib/permissions.ts
// 客户端通配符权限匹配（与服务端 @openstarter/auth 的 rbac/matcher 语义一致，R7.2–R7.4）。
//
// 供 Admin_Console 的路由守卫（R26.1）与菜单过滤（R26.4）在客户端判定当前用户是否具备某权限码。
// 这是一个纯函数副本——刻意不从 `@openstarter/auth` 导入，避免把服务端（better-auth / db）代码
// 打进客户端产物。权威判定仍在服务端中间件（requirePermission）；此处仅用于 UI 导航/守卫。

const GLOBAL_WILDCARD = "*";

/**
 * 判定 `granted` 权限码集合是否满足 `required`：
 *   - 精确命中：`granted` 含与 `required` 完全相同的码；
 *   - 资源通配：`granted` 含 `resource.*` 且 `required` 以 `resource.` 为前缀；
 *   - 全局通配：`granted` 含 `*`。
 */
export function matchPermission(required: string, granted: readonly string[]): boolean {
  if (granted.includes(GLOBAL_WILDCARD)) {
    return true;
  }
  if (granted.includes(required)) {
    return true;
  }
  const separatorIndex = required.indexOf(".");
  if (separatorIndex > 0) {
    const resource = required.slice(0, separatorIndex);
    if (granted.includes(`${resource}.${GLOBAL_WILDCARD}`)) {
      return true;
    }
  }
  return false;
}

/** 是否满足任一所需权限码（含通配符）。 */
export function matchAnyPermission(
  requiredCodes: readonly string[],
  granted: readonly string[],
): boolean {
  return requiredCodes.some((code) => matchPermission(code, granted));
}
