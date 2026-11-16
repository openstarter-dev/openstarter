import { tryGetCloudflareEnv } from "./cloudflare-env.mjs";

const cloudflareEnv = await tryGetCloudflareEnv();

/**
 * The official Workers env (bindings, vars and secrets), imported from
 * `cloudflare:workers` — see
 * https://developers.cloudflare.com/workers/runtime-apis/bindings/#importing-env-as-a-global
 *
 * Falls back to an empty object outside workerd (vitest / pure Node scripts),
 * where helpers below return their defaults.
 */
export const env: Record<string, unknown> = (cloudflareEnv ?? {}) as Record<string, unknown>;

export function readEnv(key: string): string {
  const fromCf = env[key];
  if (typeof fromCf === "string") {
    return fromCf.trim();
  }

  // Outside workerd (vitest / pure Node scripts) vars arrive via process.env
  // (vitest's vi.stubEnv writes there). In workerd both hold the same values.
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return typeof fromProcess === "string" ? fromProcess.trim() : "";
}

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

export function readPositiveNumberEnv(key: string, defaultValue: number): number {
  const raw = readEnv(key);
  if (raw === "") {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function readIntEnv(key: string, defaultValue: number): number {
  const raw = readEnv(key);
  if (raw === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
