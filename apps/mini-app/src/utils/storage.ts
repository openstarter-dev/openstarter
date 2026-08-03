import Taro from '@tarojs/taro';

const TOKEN_KEY = 'token';

/** 从本地存储中读取 token，不存在时返回 null。 */
export function getToken(): string | null {
  try {
    const value = Taro.getStorageSync(TOKEN_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** 将 token 写入本地存储。 */
export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token);
}

/** 从本地存储中移除 token。 */
export function removeToken(): void {
  Taro.removeStorageSync(TOKEN_KEY);
}