// packages/api/src/client —— 客户端 RPC 类型的唯一出口。
//
// 消费方（web / extension / mobile / mini-app）只从这里取 `hcWithType` 与 `ApiClient`，
// 不再各自 `hc<AppType>`：路由类型在 api 包内只解析一次，端上只引用已实例化的别名。
//
// `AppType` 必须是 `import type`：值导入会把整个服务端（176 条路由 + drizzle +
// better-auth）拖进扩展 / 小程序 / RN 的产物。运行时这里只带 `hono/client`。

import type { ApiResponse } from "@openstarter/shared";
import { hc } from "hono/client";
import type { ApplyGlobalResponse, ClientRequestOptions } from "hono/client";

import type { AppType } from "./index";

/**
 * 全局错误响应体：`app.onError`、鉴权 / 权限 / 套餐中间件与业务 4xx 统一走 `respErr`，
 * 形状都是 `{ code: -1, message }`。
 *
 * 刻意不声明 400：`@hono/zod-validator` 默认 hook 返回的是 Hono 原生
 * `{ success: false, error }`，不是信封；声明成信封会让客户端读一个不存在的 `message`。
 */
export type ApiGlobalError = ApiResponse;

/**
 * 补上全局错误状态码后的 app 类型（官方 `ApplyGlobalResponse` 用法）。
 *
 * `app.onError` / 全局中间件产生的响应不会被 RPC 自动推断，必须在这里显式合并，
 * 否则 `res.json()` 在错误分支上是未收窄的 `unknown`。
 */
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

// 官方 “预计算类型” 写法：在 api 包内实例化一次，端上复用 `ApiClient` 别名。
const client = hc<ApiAppType>("");

/** 已实例化类型的 RPC 客户端。 */
export type ApiClient = typeof client;

/**
 * 与 `hc` 等价，但返回已算好类型的客户端。
 *
 * 注意：本仓库 `@openstarter/api` 的 `exports` 直接指向 `src/index.ts`（无 build、无
 * `.d.ts`），因此这里拿到的是“别名收敛”的收益；要拿到官方口径的完整编译期预计算，
 * 还需要给本包加 build（`declaration`）或改用 project references。
 */
export function hcWithType(baseUrl: string, options?: ClientRequestOptions): ApiClient {
  return hc<ApiAppType>(baseUrl, options);
}
