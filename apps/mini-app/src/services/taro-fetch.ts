import Taro from "@tarojs/taro";
import { getToken } from "@/utils/storage";

/** 极简 Response shim（小程序环境无原生 Response API）。 */
export class MiniResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  private _data: unknown;

  constructor(data: unknown, status: number, headers: Record<string, string>) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._data = data;
    this.headers = {
      get: (name: string) => {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    };
  }

  async json(): Promise<unknown> {
    return this._data;
  }
}

/** 把 Taro.request 包装成标准 fetch 接口（FetchEsque）。 */
export function createTaroFetch(onUnauthorized?: () => void) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as any).url;
    const token = getToken();
    const headers = normalizeHeaders(init?.headers);

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const body = parseBody(init?.body);
    const signal = init?.signal;

    if (signal?.aborted) {
      throw abortError(signal);
    }

    const task = Taro.request({
      url,
      method: (init?.method || "GET") as any,
      header: headers,
      data: body,
    });

    let onAbort: (() => void) | undefined;
    try {
      // abort 与请求完成竞速：部分 Taro 版本 abort() 不会 reject 底层 promise，
      // 不主动 reject 会让 react-query 的 queryFn 悬挂。
      const res = await (signal
        ? new Promise<Awaited<typeof task>>((resolve, reject) => {
            onAbort = () => {
              task.abort();
              reject(abortError(signal));
            };
            signal.addEventListener("abort", onAbort, { once: true });
            task.then(resolve, reject);
          })
        : task);

      if (res.statusCode === 401) {
        onUnauthorized?.();
      }

      return new MiniResponse(res.data, res.statusCode, res.header || {}) as any as Response;
    } finally {
      if (signal && onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  };
}

function abortError(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) {
    return signal.reason;
  }
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function normalizeHeaders(
  headers?:
    | Record<string, string>
    | Array<[string, string]>
    | { entries(): Iterable<[string, string]> },
): Record<string, string> {
  if (!headers) return {};

  if (typeof (headers as any).entries === "function") {
    try {
      return Object.fromEntries((headers as any).entries());
    } catch {
      /* ignore */
    }
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers as Record<string, string>;
}

function parseBody(body: unknown): unknown {
  if (!body) return undefined;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}
