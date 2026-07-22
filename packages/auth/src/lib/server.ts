// packages/auth/src/lib/server —— 认证服务端辅助导出（@openstarter/auth 的 `./lib/server`）。
//
// 经 `server.ts` 尾部 `export * from "./lib/server"` 暴露于 @openstarter/auth/server。
// 提供从请求中提取审计 / 用户初始化元数据的纯函数（IP / User-Agent / 来源渠道），
// 对应扩展后的 `user` 表 `ip` / `utm_source` 等字段的采集来源。
//
// 约束：本模块 **不** 依赖 `./server` 的 `auth` 实例，以避免 `server ↔ lib/server`
// 的模块环依赖（ultracite「prevent import cycles」）。

/** 请求元数据：用于审计与新用户初始化的采集结果。 */
export interface RequestMetadata {
  /** 客户端 IP（依代理头解析，不可得时为空串）。 */
  ip: string;
  /** 请求 User-Agent（不可得时为空串）。 */
  userAgent: string;
  /** 来源渠道（取 query 的 `utm_source`，不可得时为空串）。 */
  utmSource: string;
}

// 依常见反向代理头解析客户端 IP：优先 x-forwarded-for 首段，其次 x-real-ip。
const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    return first?.trim() ?? "";
  }
  return request.headers.get("x-real-ip") ?? "";
};

// 从请求 URL 的 query 提取 utm_source；非法 URL 返回空串而非抛出。
const getUtmSource = (request: Request): string => {
  try {
    return new URL(request.url).searchParams.get("utm_source") ?? "";
  } catch {
    return "";
  }
};

/**
 * 从请求中提取审计 / 初始化元数据。
 *
 * `request` 可空以兼容无请求上下文的调用；缺省时返回全空串的元数据。
 */
export const getRequestMetadata = (request?: Request): RequestMetadata => {
  if (!request) {
    return { ip: "", userAgent: "", utmSource: "" };
  }
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
    utmSource: getUtmSource(request),
  };
};
