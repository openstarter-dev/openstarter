export function readEnv(key: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof fromProcess === "string") {
    return fromProcess.trim();
  }

  const cfEnv = (globalThis as { __CF_ENV__?: Record<string, unknown> }).__CF_ENV__;
  const fromCf = cfEnv?.[key];
  return typeof fromCf === "string" ? fromCf.trim() : "";
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
