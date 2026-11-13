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

export * from "./errors";
