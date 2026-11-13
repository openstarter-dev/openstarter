import type { ApiResponse } from "@openstarter/shared";
import { hc } from "hono/client";
import type { ApplyGlobalResponse, ClientRequestOptions } from "hono/client";

import type { AppType } from "./index";

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
