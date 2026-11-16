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
  baseUrl: string;
};

export function createApiClient({ baseUrl, ...options }: ApiClientOptions): ApiClient {
  return hcWithType(baseUrl, options);
}

export const withAbort = (signal: AbortSignal) => ({ init: { signal } }) as const;

export type { InferResponseType } from "hono/client";

export * from "./errors";
