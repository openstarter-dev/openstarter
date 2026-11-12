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
