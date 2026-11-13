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

export function isValidCallbackUrl(callbackUrl?: string): boolean {
  return Boolean(
    callbackUrl &&
    callbackUrl.startsWith("http") &&
    !callbackUrl.includes("localhost") &&
    !callbackUrl.includes("127.0.0.1"),
  );
}
