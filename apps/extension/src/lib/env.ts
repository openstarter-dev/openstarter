// apps/extension/src/lib/env.ts —— 校验 VITE_APP_URL，供 host_permissions（wxt.config.ts，
// Node 侧读 process.env）与运行时 API/Auth base URL（本文件，读 import.meta.env）共用同一变量，
// 避免两处派生逻辑漂移。
// 见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5/§6（misconfigured 态）。

export type EnvResult =
  | { ok: true; appUrl: string; origin: string }
  | { ok: false; reason: string };

export function resolveEnv(rawAppUrl: string | undefined): EnvResult {
  if (!rawAppUrl) {
    return { ok: false, reason: "VITE_APP_URL is not set" };
  }

  try {
    const parsed = new URL(rawAppUrl);
    return { appUrl: rawAppUrl, ok: true, origin: parsed.origin };
  } catch {
    return {
      ok: false,
      reason: `VITE_APP_URL is not a valid URL: ${rawAppUrl}`,
    };
  }
}

export function getAppUrl(): EnvResult {
  return resolveEnv(import.meta.env.VITE_APP_URL);
}
