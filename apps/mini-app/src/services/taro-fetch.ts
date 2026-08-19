// apps/mini-app/src/services/taro-fetch.ts
// Taro.request → fetch 适配器 + 极简 Response shim

import Taro from "@tarojs/taro";
import { getToken } from "@/utils/storage";

// 小程序环境无 DOM 类型，Reducer 入参使用含 any 的宽松签名（运行时校验）。
// 见 normalizeHeaders() 和 parseBody() 内 typeof 检查。

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

    const res = await Taro.request({
      url,
      method: (init?.method || "GET") as any,
      header: headers,
      data: body,
    });

    if (res.statusCode === 401) {
      onUnauthorized?.();
    }

    return new MiniResponse(res.data, res.statusCode, res.header || {}) as any as Response;
  };
}

function normalizeHeaders(
  headers?:
    | Record<string, string>
    | Array<[string, string]>
    | { entries(): Iterable<[string, string]> },
): Record<string, string> {
  if (!headers) return {};

  // Handle Headers instance (Web API, 小程序可能无此类型)
  if (typeof (headers as any).entries === "function") {
    try {
      return Object.fromEntries((headers as any).entries());
    } catch {
      /* ignore */
    }
  }

  // Handle array of tuples
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  // Handle plain object
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
