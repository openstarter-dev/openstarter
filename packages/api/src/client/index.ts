import type { ApiResponse } from "@openstarter/shared";
import { hc } from "hono/client";
import type { ApplyGlobalResponse, ClientRequestOptions } from "hono/client";

import type { AppType } from "../index";

export type ApiGlobalError = ApiResponse;

export type ApiAppType = ApplyGlobalResponse<
  AppType,
  {
    401: { json: ApiGlobalError };
    403: { json: ApiGlobalError };
    404: { json: ApiGlobalError };
    409: { json: ApiGlobalError };
    422: { json: ApiGlobalError };
    500: { json: ApiGlobalError };
  }
>;

const client = hc<ApiAppType>("");

export type ApiClient = typeof client;

export function hcWithType(baseUrl: string, options?: ClientRequestOptions): ApiClient {
  return hc<ApiAppType>(baseUrl, options);
}

export type ApiClientOptions = ClientRequestOptions & {
  /** API 根地址：web 用同源 `/`，其余端用部署后的站点 origin。 */
  baseUrl: string;
};

/** 多端统一的 client 构造入口，平台差异通过 headers / fetch 注入。 */
export function createApiClient({ baseUrl, ...options }: ApiClientOptions): ApiClient {
  return hcWithType(baseUrl, options);
}

/** Hono RPC 的 abort 参数写法，供 queryFn 透传 AbortSignal。 */
export const withAbort = (signal: AbortSignal) => ({ init: { signal } }) as const;

/** 类型工具透传：消费方从本包导入 RPC 类型工具，无需直接依赖 hono。 */
export type { InferResponseType } from "hono/client";

/** hc<AppType> 的原始 client 类型（不带全局错误包装），供 SSR 内部桥接使用。 */
export type InternalRpcClient = ReturnType<typeof hc<AppType>>;

/**
 * SSR 内部 RPC client：请求经 app.fetch 进程内直达 Hono app，不产生真实网络往返。
 * baseUrl 仅用于满足 Request 的绝对地址要求，可为任意假 host（如 http://blog.internal）。
 */
export async function createInternalRpc(baseUrl: string): Promise<InternalRpcClient> {
  const { app } = await import("../index");
  return hc<AppType>(baseUrl, {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(app.fetch(new Request(input, init))),
  });
}

export * from "./errors";
