// Shared runtime environment readers for @openstarter/api modules (Node & Cloudflare Workers).
// @openstarter/api 各模块复用的运行时环境变量读取工具（兼容 Node 与 Cloudflare Workers）。

/**
 * Read a runtime environment variable from `process.env` or Cloudflare Worker bindings.
 * 从 `process.env` 或 Cloudflare Worker 绑定读取运行时环境变量。
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
 * Parse a boolean environment flag ("true"/"1" or "false"/"0"), falling back when unset.
 * 解析布尔型环境变量（"true"/"1" 或 "false"/"0"），未设置时回退默认值。
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
  return defaultValue;
}

/**
 * Parse a positive integer/float environment variable, falling back when unset or non-positive.
 * 解析正数环境变量，未设置或非正数时回退默认值。
 */
export function readPositiveNumberEnv(key: string, defaultValue: number): number {
  const raw = readEnv(key);
  if (raw === "") {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Parse an integer environment variable, falling back when unset or non-numeric.
 * 解析整型环境变量，未设置或非数字时回退到默认值。
 */
export function readIntEnv(key: string, defaultValue: number): number {
  const raw = readEnv(key);
  if (raw === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
