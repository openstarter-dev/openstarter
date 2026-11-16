import type { HttpResponse } from "./api-error";
import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();
const baseUrl = env.ok ? env.apiUrl : "http://127.0.0.1";

type QueryParams = Record<string, string | number | undefined>;

interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<HttpResponse> {
  const cookie = await getSessionCookie();
  const headers: Record<string, string> = cookie ? { cookie } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(buildUrl(path, opts?.query), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: opts?.signal,
  });
}

export const apiClient = {
  get: (path: string, opts?: RequestOptions): Promise<HttpResponse> =>
    request("GET", path, undefined, opts),
  post: (path: string, body?: unknown, opts?: RequestOptions): Promise<HttpResponse> =>
    request("POST", path, body, opts),
};
