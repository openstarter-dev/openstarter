import { createTaroFetch } from "./taro-fetch";
import { useAuthStore } from "@/stores/auth-store";
import { removeToken } from "@/utils/storage";
import Taro from "@tarojs/taro";
import { getApiBaseUrl } from "@/lib/env";

function handleUnauthorized() {
  removeToken();
  useAuthStore.getState().logout();
  Taro.reLaunch({ url: "/pages/login/index" });
}

const taroFetch = createTaroFetch(handleUnauthorized);
const baseUrl = getApiBaseUrl();

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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return taroFetch(buildUrl(path, opts?.query), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: opts?.signal,
  });
}

export const client = {
  get: (path: string, opts?: RequestOptions): Promise<HttpResponse> =>
    request("GET", path, undefined, opts),
  post: (path: string, body?: unknown, opts?: RequestOptions): Promise<HttpResponse> =>
    request("POST", path, body, opts),
};
