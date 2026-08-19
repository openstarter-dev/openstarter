/**
 * API 客户端封装：统一组装 Bearer 头、解包 `{ code, message, data? }` 响应信封
 * （对齐 @openstarter/shared），并把 HTTP/语义错误映射到 CLI 错误类与退出码。
 *
 * 不依赖 Hono RPC 类型（CLI 保持轻量与快启动）；仅做 fetch 包装 + 信封解包。
 */

import type { ApiResponse } from "../types.js";
import { config } from "./config.js";
import { ApiError, AuthError, NetworkError } from "./errors.js";

const JSON_CONTENT_TYPE = "application/json";

/** 调用方可覆盖的请求头子集（避免依赖 DOM-only 的 HeadersInit 类型）。 */
type HeaderOverride = Record<string, string> | undefined;

/** 构造一次请求所需的基础 URL 与鉴权头快照。 */
export interface ApiClient {
  readonly apiUrl: string;
  /** 发起请求并解包信封；失败抛出 AuthError/ApiError/NetworkError。 */
  request: <TData = unknown>(
    path: string,
    init?: RequestInit & { headers?: HeaderOverride },
  ) => Promise<TData>;
}

/** 检查是否已登录，未登录直接抛 AuthError（退出码 2）。 */
export function requireAuthOrThrow(): void {
  if (!config.isAuthenticated()) {
    throw new AuthError("未登录，请先运行 openstarter login");
  }
}

/** 构造 API 客户端：附带 Bearer 令牌（若已登录）。 */
export function createApiClient(): ApiClient {
  const apiUrl = config.getApiUrl();
  const token = config.getAccessToken();

  const baseHeaders: Record<string, string> = {
    "Content-Type": JSON_CONTENT_TYPE,
  };
  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  async function request<TData = unknown>(
    path: string,
    init?: RequestInit & { headers?: HeaderOverride },
  ): Promise<TData> {
    const response = await send(`${apiUrl}${path}`, {
      ...init,
      headers: mergeHeaders(baseHeaders, init?.headers),
    });

    if (response.status === 401) {
      config.clearAuth();
      throw new AuthError("认证已过期，请重新登录");
    }
    if (response.status === 403) {
      throw new ApiError("权限不足", 403);
    }
    if (response.status === 404) {
      throw new ApiError("资源不存在", 404);
    }
    if (response.status === 422) {
      throw await validationError(response);
    }
    if (response.status === 429) {
      throw new ApiError("请求过于频繁，请稍后重试", 429);
    }
    if (response.status >= 500) {
      throw new ApiError("服务器错误，请稍后重试", response.status);
    }
    if (!response.ok) {
      throw new ApiError(`API 错误: ${response.statusText}`, response.status);
    }

    return unwrapEnvelope<TData>(response);
  }

  return { apiUrl, request };
}

async function unwrapEnvelope<TData>(response: Response): Promise<TData> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined as TData;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: ApiError 构造签名为 (message, statusCode, options)，cause 在第 3 参，规则按标准 Error(message, options) 启发式匹配，无法识别。
    throw new ApiError("API 返回了无法解析的响应", undefined, {
      cause: error,
    });
  }

  // 纯数组/原始值（非信封）按原样返回，兼容非标准端点。
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("code" in parsed)
  ) {
    return parsed as TData;
  }

  const envelope = parsed as ApiResponse<TData>;
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || `API 错误 (code=${envelope.code})`);
  }
  return (envelope.data ?? undefined) as TData;
}

async function send(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof Error) {
      throw new NetworkError(`网络请求失败: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}

function mergeHeaders(
  base: Record<string, string>,
  override?: HeaderOverride,
): Record<string, string> {
  if (!override) {
    return { ...base };
  }
  return { ...base, ...override };
}

async function validationError(response: Response): Promise<ApiError> {
  let detail = "";
  try {
    const body = (await response.json()) as ApiResponse;
    detail = body.message || "";
  } catch {
    /* 保留空 detail */
  }
  return new ApiError(`验证错误: ${detail || response.statusText}`, 422);
}
