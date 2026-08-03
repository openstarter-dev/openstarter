import { hc } from 'hono/client';
import type { AppType } from '@openstarter/api';
import { getToken, removeToken } from '@/utils/storage';

/** 构建期由 Taro defineConstants 注入的 API 基础地址。 */
declare const API_BASE_URL: string;

/** 获取 API 基础地址（构建期注入，测试环境 fallback）。 */
export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3000';
}

/** 创建一个已注入 auth token 的 Hono RPC 客户端。 */
export function createClient() {
  const token = getToken();

  return hc<AppType>(getApiBaseUrl(), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * 发送原始 API 请求（当 Hono RPC 类型不匹配时用）。
 * 自动携带 token，401 时清除 token 并跳转登录页。
 */
export async function request<TData = unknown>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<{ data?: TData; error?: string }> {
  const token = getToken();
  const { method = 'GET', body, params } = options;

  // 构建 URL
  let url = `${getApiBaseUrl()}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  try {
    const { Taro } = await import('@tarojs/taro');
    const res = await Taro.request({
      url,
      method: method as keyof Taro.request.Method,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: body,
    });

    const result = res.data as { code: number; message: string; data?: TData };

    // 401 时清除 token 并跳转登录页
    if (res.statusCode === 401) {
      removeToken();
      Taro.reLaunch({ url: '/pages/login/index' });
      return { error: 'Authentication expired' };
    }

    if (result.code !== 0) {
      return { error: result.message || 'Unknown error' };
    }

    return { data: result.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}