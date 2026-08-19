// @openstarter/shared/resp 统一响应封装。
// 对齐 ShipAny `lib/resp.ts` 的响应约定 `{ code, message, data? }`：
//   - 成功 code = 0、message = "ok"；失败 code = -1、message 为错误信息。
// 与 ShipAny 不同的是：这里返回「纯对象」而非 `Response`，以便 packages/api 的 Hono 路由
// 经 `c.json(...)` 返回并让 Hono RPC（AppType）推导出精确的响应类型。

// 成功码与失败码（对齐 ShipAny 的 0 / -1 约定）。
export const RespCode = {
  OK: 0,
  ERROR: -1,
} as const;

export type RespCode = (typeof RespCode)[keyof typeof RespCode];

/**
 * 统一响应信封。`data` 可选：成功且无数据（respOk）或失败（respErr）时省略。
 */
export type ApiResponse<TData = unknown> = {
  code: number;
  message: string;
  data?: TData;
};

/**
 * 分页数据载荷：与 respPage 的返回结构一致。
 */
export type PageData<TItem> = {
  items: TItem[];
  total: number;
};

/**
 * 成功响应并携带数据。
 */
export function respData<TData>(data: TData): ApiResponse<TData> {
  return { code: RespCode.OK, message: "ok", data };
}

/**
 * 成功响应但不携带数据。
 */
export function respOk(): ApiResponse {
  return { code: RespCode.OK, message: "ok" };
}

/**
 * 失败响应，携带可读错误信息。
 */
export function respErr(message: string): ApiResponse {
  return { code: RespCode.ERROR, message };
}

/**
 * 成功响应并携带分页数据（条目列表与总数）。
 */
export function respPage<TItem>(items: TItem[], total: number): ApiResponse<PageData<TItem>> {
  return { code: RespCode.OK, message: "ok", data: { items, total } };
}
