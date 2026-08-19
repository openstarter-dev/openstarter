// packages/api/src/ai/utils —— AI 域内共享的纯工具（供各 provider 的入参构建复用）。

/** 返回不含指定键的浅拷贝（替代 `delete`，遵循 ultracite 的「禁用 delete」）。 */
export function omitKeys(
  obj: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!keys.includes(key)) {
      result[key] = value;
    }
  }
  return result;
}

/** 回调 URL 是否可用于 webhook（http(s) 且非本地回环，供应商无法回调本地地址）。 */
export function isValidCallbackUrl(callbackUrl?: string): boolean {
  return Boolean(
    callbackUrl &&
    callbackUrl.startsWith("http") &&
    !callbackUrl.includes("localhost") &&
    !callbackUrl.includes("127.0.0.1"),
  );
}
