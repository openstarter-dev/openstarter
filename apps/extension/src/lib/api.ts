import type { CookieReader } from "./session";
import { readSessionToken } from "./session";

export async function buildAuthHeader(
  origin: string,
  cookieReader: CookieReader,
): Promise<Record<string, string>> {
  const token = await readSessionToken(origin, cookieReader);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type QueryParams = Record<string, string | number | undefined>;

interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

interface HttpResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

function buildUrl(origin: string, path: string, query?: QueryParams): string {
  const url = `${origin}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export function createExtensionApiClient(origin: string, cookieReader: CookieReader) {
  async function request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = await buildAuthHeader(origin, cookieReader);
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(buildUrl(origin, path, opts?.query), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: opts?.signal,
    });
  }

  return {
    get: (path: string, opts?: RequestOptions): Promise<HttpResponse> =>
      request("GET", path, undefined, opts),
    post: (path: string, body?: unknown, opts?: RequestOptions): Promise<HttpResponse> =>
      request("POST", path, body, opts),
  };
}
