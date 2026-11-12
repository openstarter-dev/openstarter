export type EnvResult = { ok: true; apiUrl: string } | { ok: false; reason: string };

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveApiUrl(raw: string | undefined): EnvResult {
  if (!raw) {
    return { ok: false, reason: "EXPO_PUBLIC_API_URL is not set" };
  }

  if (!isValidHttpUrl(raw)) {
    return {
      ok: false,
      reason: `EXPO_PUBLIC_API_URL is not a valid absolute URL: ${raw}`,
    };
  }

  return { apiUrl: raw.replace(/\/$/u, ""), ok: true };
}

export function getEnv(): EnvResult {
  return resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
