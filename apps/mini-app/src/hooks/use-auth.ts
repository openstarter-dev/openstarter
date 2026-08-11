// apps/mini-app/src/hooks/use-auth.ts
// 认证 hook（整合 better-auth client）

import { useCallback } from 'react';
import { useAuthStore, type UserInfo } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isHydrated,
    setSession,
    logout: storeLogout,
  } = useAuthStore();

  const isLoading = !isHydrated;

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        let bearerToken: string | null = null;

        const result = await authClient.signIn.email(
          { email, password },
          {
            onSuccess: (ctx: any) => {
              bearerToken = ctx.response.headers.get("set-auth-token");
            },
          }
        );

        if (result.error) {
          return { error: result.error.message || 'Login failed' };
        }

        if (result.data?.user && bearerToken) {
          setSession(bearerToken, result.data.user as UserInfo);
          return { data: result.data };
        }

        return { error: 'Login failed: missing token or user' };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Login failed' };
      }
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    await authClient.signOut();
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