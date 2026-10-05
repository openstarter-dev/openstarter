export interface ApiRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  error?: unknown;
}

export interface ApiProxyOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetchFn?: typeof fetch;
}

/**
 * 从 baseUrl 推导随请求发送的 Origin 头。
 *
 * 主进程用 Node fetch 直接调后端，不像浏览器会自动带 Origin/Referer；
 * better-auth 的 origin 校验缺了这两个头会直接 403（"Missing or null Origin"）。
 * baseUrl 本就是 API 自身的源，照原样声明即为同源请求，后端（含 dev 的
 * `http://localhost*` 通配 trustedOrigins）必然放行。
 */
export function getRequestOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

export function createApiProxy(options: ApiProxyOptions) {
  const { baseUrl, getToken, fetchFn = fetch } = options;

  return async (request: ApiRequest): Promise<ApiResponse> => {
    // Validate path
    if (!request.path.startsWith("/api/")) {
      return {
        code: -1,
        message: "invalid request path",
      };
    }

    const url = `${baseUrl}${request.path}`;
    const token = getToken();

    try {
      const response = await fetchFn(url, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          Origin: getRequestOrigin(baseUrl),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      // Handle 401 — token expired
      if (response.status === 401) {
        return {
          code: 401,
          message: "session_expired",
        };
      }

      const rawData: unknown = await response.json();
      // API 响应统一为 envelope：{ code, message, data, error? }
      const data = rawData as {
        code?: number;
        message?: string;
        data?: unknown;
        error?: unknown;
      };

      // API returned an error
      if (!response.ok) {
        return {
          code: (data.code as number) || response.status,
          message: data.message || `HTTP ${response.status}`,
          error: data.error,
        };
      }

      // Success
      return {
        code: 200,
        message: "ok",
        data: data.data,
      };
    } catch (error) {
      return {
        code: -1,
        message: "network_error",
        error: String(error),
      };
    }
  };
}
