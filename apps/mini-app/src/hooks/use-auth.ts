import { useCallback } from 'react';
import { useAuthStore, type UserInfo } from '@/stores/auth-store';
import { request } from '@/services/client';

/**
 * 认证相关 hook，封装登录/登出逻辑和认证状态。
 * 页面组件通过此 hook 而非直接操作 store。
 */
export function useAuth() {
  const {
    token,
    user,
    isAuthenticated,
    isHydrated,
    setSession,
    logout: storeLogout,
  } = useAuthStore();

  const isLoading = !isHydrated;

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await request<{ token: string; user: UserInfo }>(
        '/api/auth/email-password/login',
        {
          method: 'POST',
          body: { email, password },
        },
      );

      if (result.data) {
        setSession(result.data.token, result.data.user);
      }

      return result;
    },
    [setSession],
  );

  const logout = useCallback(() => {
    storeLogout();
  }, [storeLogout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}