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
