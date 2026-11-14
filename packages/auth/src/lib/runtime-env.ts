// Runtime environment readers for @openstarter/auth (Node & Cloudflare Workers).
// @openstarter/auth 运行时环境变量读取工具（兼容 Node 与 Cloudflare Workers）。

/**
 * Read a runtime environment variable from `process.env` or Cloudflare Worker bindings.
 * 从 `process.env` 或 Cloudflare Worker 绑定读取环境变量。
 */
export function readEnv(key: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof fromProcess === "string") {
    return fromProcess.trim();
  }

  const cfEnv = (globalThis as { __CF_ENV__?: Record<string, unknown> }).__CF_ENV__;
  const fromCf = cfEnv?.[key];
  return typeof fromCf === "string" ? fromCf.trim() : "";
}

/**
 * Parse a boolean environment flag ("true"/"1" or "false"/"0"), throwing on invalid non-empty values.
 * 解析布尔环境变量（"true"/"1" 或 "false"/"0"）；空值使用默认值，非法非空值立即报错。
 */
export function readBooleanEnv(key: string, defaultValue = false): boolean {
  const raw = readEnv(key).toLowerCase();
  if (raw === "") {
    return defaultValue;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  throw new Error(`Environment variable ${key} must be true/false or 1/0`);
}

/**
 * Parse a positive integer environment variable with a fallback default.
 * 解析正整数环境变量，未设置或无效时回退默认值。
 */
export function readPositiveIntEnv(key: string, defaultValue: number): number {
  const raw = readEnv(key);
  if (raw === "") {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
